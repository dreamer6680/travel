from __future__ import annotations

from typing import Any, Dict, List, Tuple


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


def enhance_trip_locations(trip: Dict[str, Any]) -> Dict[str, Any]:
    destination = str(trip.get("destination", ""))
    days: List[Dict[str, Any]] = trip.get("days", []) or []

    all_locations: List[Dict[str, Any]] = []
    seen = set()
    enhanced_days: List[Dict[str, Any]] = []

    for day in days:
        enhanced_activities = []
        for act in day.get("activities", []) or []:
            location_name = _extract_location(act, destination)
            lat, lng = _hash_coord(f"{destination}:{location_name}")
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
