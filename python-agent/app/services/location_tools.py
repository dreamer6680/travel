from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

from ..config import settings
from .pg_vector_store import pg_vector_store

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 坐标工具
# ---------------------------------------------------------------------------

def _hash_coord(name: str) -> Tuple[float, float]:
    """在无任何数据时生成稳定伪坐标，仅作最终 fallback，避免前端崩溃。"""
    h = abs(hash(name))
    lat = 20.0 + (h % 2000) / 100.0
    lng = 100.0 + ((h // 2000) % 2000) / 100.0
    return round(lat, 6), round(lng, 6)


def _extract_search_keyword(title: str, location: str, destination: str) -> str:
    """从活动标题/location 中提取最适合搜索的关键词，去除动词前缀和城市名前缀。"""
    base = (location or title).strip()
    # 去掉城市名前缀
    if destination and base.startswith(destination):
        base = base[len(destination):].strip()
    # 去掉常见动词前缀
    for prefix in ("前往", "参观", "游览", "品尝", "体验", "探索", "抵达", "入住", "观光"):
        if base.startswith(prefix):
            base = base[len(prefix):].strip()
    # 取第一个逗号/顿号前的部分
    for sep in ("，", ",", "、", "及", "和"):
        if sep in base:
            base = base.split(sep)[0].strip()
    return base or title[:20]


async def _geocode_amap(address: str, city: str) -> Optional[Tuple[float, float]]:
    """调用高德 Web 服务地理编码接口。"""
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
            loc_str = data["geocodes"][0].get("location", "")
            if "," in loc_str:
                lng_s, lat_s = loc_str.split(",", 1)
                return float(lat_s), float(lng_s)
    except Exception as exc:
        logger.debug("高德 geocode 失败 '%s': %s", address, exc)
    return None


async def _get_amap_transit_route(
    origin: Dict[str, float], destination_coord: Dict[str, float], city: str
) -> Optional[Dict[str, Any]]:
    """调用高德公共交通路线规划 API，返回简化后的路线信息。

    对应 v2 的 amap-transit-service.ts getTransitRoute()。
    """
    if not settings.amap_web_service_key:
        return None
    params = {
        "key": settings.amap_web_service_key,
        "origin": f"{origin['lng']},{origin['lat']}",
        "destination": f"{destination_coord['lng']},{destination_coord['lat']}",
        "city": city,
        "output": "json",
        "extensions": "base",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://restapi.amap.com/v3/direction/transit/integrated", params=params
            )
            resp.raise_for_status()
            data = resp.json()
        if data.get("status") == "1":
            route_data = data.get("route", {})
            transits = route_data.get("transits", [])
            if transits:
                best = transits[0]
                return {
                    "duration": int(best.get("duration", 0)),
                    "walking_distance": int(best.get("walking_distance", 0)),
                    "cost": float(best.get("cost", {}).get("transit_fee", 0)),
                    "segments": [
                        {
                            "type": seg.get("bus", {}).get("buslines", [{}])[0].get("type", "步行")
                            if seg.get("bus")
                            else "步行",
                            "name": seg.get("bus", {}).get("buslines", [{}])[0].get("name", "")
                            if seg.get("bus")
                            else "",
                        }
                        for seg in best.get("segments", [])
                    ],
                }
    except Exception as exc:
        logger.debug("高德公交路线规划失败: %s", exc)
    return None


async def geocode_name(name: str, city: str) -> Dict[str, float]:
    """综合坐标查询：优先 DB 查询，再 Amap，最后伪坐标兜底。"""
    # 1. DB 优先
    keyword = _extract_search_keyword(name, "", city)
    if len(keyword) >= 2:
        coord = await pg_vector_store.lookup_attraction_coord(keyword, city)
        if coord:
            logger.debug("DB 匹配坐标: %s -> %s", name, coord)
            return coord

    # 2. 高德地理编码
    geo = await _geocode_amap(name, city)
    if geo:
        return {"lat": geo[0], "lng": geo[1]}

    # 3. 伪坐标兜底
    lat, lng = _hash_coord(f"{city}:{name}")
    return {"lat": lat, "lng": lng}


# ---------------------------------------------------------------------------
# 行程地点增强（供 /v1/trips/locations 端点使用）
# ---------------------------------------------------------------------------

async def enhance_trip_locations(trip: Dict[str, Any]) -> Dict[str, Any]:
    """为行程中每个活动补充坐标，并在相邻有坐标活动间规划公交路线。

    查询策略（对应 v2 trip-location-enhancer.ts）：
    1. 按活动 title/location 查 attraction_vectors 表
    2. 未命中则调用高德地理编码
    3. 两者均失败则使用伪坐标兜底
    """
    destination = str(trip.get("destination", ""))
    days: List[Dict[str, Any]] = trip.get("days", []) or []

    all_locations: List[Dict[str, Any]] = []
    seen: set = set()
    enhanced_days: List[Dict[str, Any]] = []

    for day in days:
        enhanced_activities: List[Dict[str, Any]] = []
        activities = day.get("activities", []) or []

        # ---- 步骤 1: 批量查坐标 ----
        activity_coords: List[Optional[Dict[str, float]]] = []
        for act in activities:
            title = str(act.get("title", "")).strip()
            location = str(act.get("location", "")).strip()
            keyword = _extract_search_keyword(title, location, destination)

            coord: Optional[Dict[str, float]] = None

            # DB 优先
            if len(keyword) >= 2:
                coord = await pg_vector_store.lookup_attraction_coord(keyword, destination)

            # fallback: 高德 geocode
            if not coord:
                address = location or title
                geo = await _geocode_amap(address, destination)
                if geo:
                    coord = {"lat": geo[0], "lng": geo[1]}

            # 最终 fallback: 伪坐标（仅当没有 Amap key 时才触发）
            if not coord:
                lat, lng = _hash_coord(f"{destination}:{title}")
                coord = {"lat": lat, "lng": lng}

            activity_coords.append(coord)

            loc_name = location or title
            enriched = {**act, "location": loc_name, "coordinate": coord}
            enhanced_activities.append(enriched)

            if loc_name not in seen:
                seen.add(loc_name)
                all_locations.append({"name": loc_name, "coordinate": coord})

        # ---- 步骤 2: 相邻活动间公交路线规划 ----
        transit_segments: List[Dict[str, Any]] = []
        indexed_with_coord = [
            (i, act, coord)
            for i, (act, coord) in enumerate(zip(enhanced_activities, activity_coords))
            if coord is not None
        ]
        for j in range(len(indexed_with_coord) - 1):
            i_from, act_from, coord_from = indexed_with_coord[j]
            i_to, act_to, coord_to = indexed_with_coord[j + 1]
            route = await _get_amap_transit_route(coord_from, coord_to, destination)
            if route:
                transit_segments.append(
                    {
                        "fromTitle": act_from.get("title", ""),
                        "toTitle": act_to.get("title", ""),
                        "fromIndex": i_from,
                        "toIndex": i_to,
                        "route": route,
                    }
                )

        day_out: Dict[str, Any] = {**day, "activities": enhanced_activities}
        if transit_segments:
            day_out["transitSegments"] = transit_segments
        enhanced_days.append(day_out)

    return {
        "destination": destination,
        "days": enhanced_days,
        "allLocations": all_locations,
    }
