from __future__ import annotations

from typing import Any, Dict, List, Tuple
import httpx

from ..config import settings


def _hash_coord(name: str) -> Tuple[float, float]:
    # 生成稳定的伪坐标，避免无地图数据时前端完全不可用
    h = abs(hash(name))
    lat = 20.0 + (h % 2000) / 100.0
    lng = 100.0 + ((h // 2000) % 2000) / 100.0
    return round(lat, 6), round(lng, 6)


def _extract_location(activity: Dict[str, Any], destination: str) -> str:
    title = str(activity.get("title", "")).strip()
    location = str(activity.get("location", "")).strip()
    base = location or title or destination
    return base[:50]


async def geocode_name(name: str, city: str) -> Dict[str, float]:
    geo = await _geocode_amap(name, city)
    if geo is None:
        lat, lng = _hash_coord(f"{city}:{name}")
    else:
        lat, lng = geo
    return {"lat": lat, "lng": lng}


async def _geocode_amap(address: str, city: str) -> Tuple[float, float] | None:
    if not settings.amap_web_service_key:
        return None
    params = {
        "key": settings.amap_web_service_key,
        "address": address,
        "city": city,
        "output": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get("https://restapi.amap.com/v3/geocode/geo", params=params)
            resp.raise_for_status()
            data = resp.json()
        if data.get("status") == "1" and data.get("geocodes"):
            location = data["geocodes"][0].get("location", "")
            if "," in location:
                lng, lat = location.split(",", 1)
                return float(lat), float(lng)
    except Exception:
        return None
    return None


async def enhance_trip_locations(trip: Dict[str, Any]) -> Dict[str, Any]:
    destination = str(trip.get("destination", ""))
    days: List[Dict[str, Any]] = trip.get("days", []) or []

    all_locations: List[Dict[str, Any]] = []
    seen = set()
    enhanced_days: List[Dict[str, Any]] = []

    for day in days:
        enhanced_activities = []
        for act in day.get("activities", []) or []:
            location_name = _extract_location(act, destination)
            geo = await _geocode_amap(location_name, destination)
            if geo is None:
                lat, lng = _hash_coord(f"{destination}:{location_name}")
            else:
                lat, lng = geo
            enriched = {
                **act,
                "location": location_name,
                "coordinate": {"lat": lat, "lng": lng},
            }
            enhanced_activities.append(enriched)
            if location_name not in seen:
                seen.add(location_name)
                all_locations.append({"name": location_name, "coordinate": {"lat": lat, "lng": lng}})

        enhanced_days.append({**day, "activities": enhanced_activities})

    return {
        "destination": destination,
        "days": enhanced_days,
        "allLocations": all_locations,
    }
