from __future__ import annotations

import logging
from typing import Any, Dict, List, Literal, Optional, Tuple

import httpx

from ..config import settings
from .pg_vector_store import pg_vector_store

logger = logging.getLogger(__name__)

# 高德 GCJ02 近似市中心；无 Web Key、DB 也无坐标时优于随机伪点
_CITY_GCJ02_CENTERS: Dict[str, Tuple[float, float]] = {
    "上海": (31.230416, 121.473701),
    "北京": (39.904212, 116.407395),
    "广州": (23.129110, 113.264385),
    "深圳": (22.543096, 114.057865),
    "杭州": (30.274084, 120.155070),
    "成都": (30.572815, 104.066801),
    "重庆": (29.563010, 106.551556),
    "西安": (34.341568, 108.940174),
    "南京": (32.060255, 118.796877),
    "苏州": (31.298886, 120.585315),
    "武汉": (30.592849, 114.305539),
    "天津": (39.343357, 117.361649),
    "厦门": (24.479834, 118.089425),
    "青岛": (36.067082, 120.382639),
    "三亚": (18.252847, 109.511909),
    "昆明": (25.040609, 102.712251),
    "香港": (22.319304, 114.169361),
    "澳门": (22.198745, 113.543873),
}


# ---------------------------------------------------------------------------
# 坐标工具
# ---------------------------------------------------------------------------

def _hash_coord(name: str) -> Tuple[float, float]:
    """最后兜底：稳定伪坐标（仅当城市中心也无法推断时使用，地图位置仍可能不准）。"""
    h = abs(hash(name))
    lat = 20.0 + (h % 2000) / 100.0
    lng = 100.0 + ((h // 2000) % 2000) / 100.0
    return round(lat, 6), round(lng, 6)


def _fallback_city_center(city: str) -> Optional[Tuple[float, float]]:
    if not city:
        return None
    for key, coord in _CITY_GCJ02_CENTERS.items():
        if key in city:
            return coord
    return None


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


def _is_generic_location(loc: str, destination: str) -> bool:
    """location 仅为城市名时，不能单独拿去 geocode，否则所有点叠在同一市中心。"""
    if not loc:
        return True
    s = loc.strip()
    dest = (destination or "").strip()
    if not dest:
        return len(s) <= 3
    if s == dest or s == f"{dest}市" or s == f"{dest}省":
        return True
    if s in ("中国", "中华人民共和国"):
        return True
    if len(s) <= 4 and dest in s and len(s) <= len(dest) + 2:
        return True
    return False


def _build_geocode_address(name: str, location: str, destination: str) -> str:
    """拼出适合高德地理编码的地址串。"""
    nm = (name or "").strip()
    loc = (location or "").strip()
    dest = (destination or "").strip()
    if _is_generic_location(loc, dest):
        core = nm or loc
    else:
        core = loc or nm
    if not core:
        return ""
    if dest and dest not in core and not core.startswith(dest):
        return f"{dest}{core}"
    return core


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


def _decode_amap_polyline(polyline_str: str) -> List[Dict[str, float]]:
    """将高德 polyline 字符串（'lng,lat;lng,lat;...'）解码为坐标列表。"""
    if not polyline_str:
        return []
    coords: List[Dict[str, float]] = []
    for pair in polyline_str.split(";"):
        pair = pair.strip()
        if "," in pair:
            try:
                lng_s, lat_s = pair.split(",", 1)
                coords.append({"lat": float(lat_s), "lng": float(lng_s)})
            except ValueError:
                pass
    return coords


async def _get_amap_transit_route(
    origin: Dict[str, float], destination_coord: Dict[str, float], city: str
) -> Optional[Dict[str, Any]]:
    """调用高德公共交通路线规划 API，返回含完整 polyline 路径的路线信息。

    使用 extensions=all 以获取每个换乘段的详细路径坐标。
    """
    if not settings.amap_web_service_key:
        return None
    params = {
        "key": settings.amap_web_service_key,
        "origin": f"{origin['lng']},{origin['lat']}",
        "destination": f"{destination_coord['lng']},{destination_coord['lat']}",
        "city": city,
        "output": "json",
        "extensions": "all",
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
                # 拼接所有换乘段 polyline
                full_path: List[Dict[str, float]] = []
                seg_info = []
                for seg in best.get("segments", []):
                    walking = seg.get("walking") or {}
                    bus_data = seg.get("bus") or {}
                    buslines = bus_data.get("buslines") or []
                    if walking:
                        for step in walking.get("steps") or []:
                            full_path.extend(_decode_amap_polyline(step.get("polyline", "")))
                        seg_info.append({"type": "步行", "name": ""})
                    if buslines:
                        bl = buslines[0]
                        full_path.extend(_decode_amap_polyline(bl.get("polyline", "")))
                        seg_info.append({
                            "type": bl.get("type", "公交"),
                            "name": bl.get("name", ""),
                        })
                return {
                    "duration": int(best.get("duration", 0)),
                    "walking_distance": int(best.get("walking_distance", 0)),
                    "cost": float((best.get("cost") or {}).get("transit_fee", 0)),
                    "segments": seg_info,
                    "polyline": full_path,
                }
    except Exception as exc:
        logger.debug("高德公交路线规划失败: %s", exc)
    return None


async def _get_amap_walking_route(
    origin: Dict[str, float], destination_coord: Dict[str, float]
) -> Optional[Dict[str, Any]]:
    """调用高德步行路线规划 API，作为公交路线的兜底方案。"""
    if not settings.amap_web_service_key:
        return None
    params = {
        "key": settings.amap_web_service_key,
        "origin": f"{origin['lng']},{origin['lat']}",
        "destination": f"{destination_coord['lng']},{destination_coord['lat']}",
        "output": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://restapi.amap.com/v3/direction/walking", params=params
            )
            resp.raise_for_status()
            data = resp.json()
        if data.get("status") == "1":
            paths = (data.get("route") or {}).get("paths") or []
            if paths:
                best = paths[0]
                full_path: List[Dict[str, float]] = []
                for step in best.get("steps") or []:
                    full_path.extend(_decode_amap_polyline(step.get("polyline", "")))
                return {
                    "duration": int(best.get("duration", 0)),
                    "walking_distance": int(best.get("distance", 0)),
                    "cost": 0.0,
                    "segments": [{"type": "步行", "name": "步行路线"}],
                    "polyline": full_path,
                }
    except Exception as exc:
        logger.debug("高德步行路线规划失败: %s", exc)
    return None


async def _geocode_amap_multi(name: str, location: str, city: str) -> Optional[Tuple[float, float]]:
    """多候选串依次 geocode，提高命中率。"""
    queries: List[str] = []
    primary = _build_geocode_address(name, location, city)
    if primary:
        queries.append(primary)
    nm = (name or "").strip()
    dest = (city or "").strip()
    if nm and nm not in (primary or ""):
        if dest and dest not in nm:
            queries.append(f"{dest}{nm}")
        queries.append(nm)
    seen: set[str] = set()
    for q in queries:
        q = q.strip()
        if len(q) < 2 or q in seen:
            continue
        seen.add(q)
        geo = await _geocode_amap(q, city)
        if geo:
            return geo
    return None


async def geocode_poi(
    name: str,
    location: str,
    city: str,
    *,
    entity: Literal["attraction", "hotel"] = "attraction",
) -> Dict[str, float]:
    """综合坐标：PG 向量表（按城市过滤）→ 高德多策略 → 城市中心 → 伪坐标。"""
    keyword = _extract_search_keyword(name or "", location or "", city)
    if len(keyword) >= 2:
        if entity == "hotel":
            coord = await pg_vector_store.lookup_hotel_coord(keyword, city)
        else:
            coord = await pg_vector_store.lookup_attraction_coord(keyword, city)
        if coord:
            logger.debug("DB 匹配坐标 [%s] %s -> %s", entity, name, coord)
            return coord

    geo = await _geocode_amap_multi(name, location, city)
    if geo:
        return {"lat": geo[0], "lng": geo[1]}

    center = _fallback_city_center(city)
    if center:
        logger.warning(
            "无高德/DB 精确坐标，使用「%s」近似市中心作为兜底: %s / loc=%s",
            city,
            (name or "")[:40],
            (location or "")[:40],
        )
        return {"lat": center[0], "lng": center[1]}

    lat, lng = _hash_coord(f"{city}:{name}:{location}")
    logger.warning("坐标最终伪随机兜底（请配置 AMAP_WEB_SERVICE_KEY 或补全 PG 坐标）: %s", name[:40])
    return {"lat": lat, "lng": lng}


async def geocode_name(name: str, city: str) -> Dict[str, float]:
    """兼容旧调用：单字符串视为 POI 名称。"""
    return await geocode_poi(name, "", city, entity="attraction")


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
            coord = await geocode_poi(title, location, destination, entity="attraction")
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
            # 公交路线无结果或无 polyline 时降级到步行路线
            if not route or not route.get("polyline"):
                route = await _get_amap_walking_route(coord_from, coord_to)
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
