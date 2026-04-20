from __future__ import annotations

import logging
import re
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional, Tuple

import httpx

from ..config import settings
from .pg_vector_store import pg_vector_store

logger = logging.getLogger(__name__)
_PLACEHOLDER_NULL_TEXT = {"none", "null", "nan", "undefined", "-"}


def _json_safe(obj: Any) -> Any:
    """保证 FastAPI/JSON 可序列化（Decimal 等）。"""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, tuple):
        return tuple(_json_safe(v) for v in obj)
    return obj


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
        logger.warning(
            "高德公交规划跳过: 未配置 AMAP_WEB_SERVICE_KEY（也未从 NEXT_PUBLIC_AMAP_KEY 回退到非空），无法请求 transit/integrated"
        )
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
        api_status = data.get("status")
        if api_status != "1":
            logger.warning(
                "高德公交规划 API 非成功: status=%s infocode=%s info=%s city=%s origin=%s,%s dest=%s,%s",
                api_status,
                data.get("infocode"),
                data.get("info"),
                city,
                origin.get("lng"),
                origin.get("lat"),
                destination_coord.get("lng"),
                destination_coord.get("lat"),
            )
            return None
        route_data = data.get("route") or {}
        if not isinstance(route_data, dict):
            logger.warning("高德公交规划: route 非对象，已忽略 type=%s", type(route_data).__name__)
            return None
        transits = route_data.get("transits", [])
        if not transits:
            logger.warning(
                "高德公交规划无方案: transits 为空 city=%s origin=%.5f,%.5f dest=%.5f,%.5f",
                city,
                origin.get("lng", 0),
                origin.get("lat", 0),
                destination_coord.get("lng", 0),
                destination_coord.get("lat", 0),
            )
            return None
        best = transits[0]
        full_path: List[Dict[str, float]] = []
        seg_info = []
        for seg in best.get("segments") or []:
            if not isinstance(seg, dict):
                continue
            walking_raw = seg.get("walking")
            walking = walking_raw if isinstance(walking_raw, dict) else {}
            bus_raw = seg.get("bus")
            bus_data = bus_raw if isinstance(bus_raw, dict) else {}
            buslines = bus_data.get("buslines") or []
            if not isinstance(buslines, list):
                buslines = []
            if walking:
                for step in walking.get("steps") or []:
                    if not isinstance(step, dict):
                        continue
                    full_path.extend(_decode_amap_polyline(step.get("polyline", "")))
                seg_info.append({"type": "步行", "name": ""})
            if buslines:
                bl = buslines[0]
                if not isinstance(bl, dict):
                    continue
                full_path.extend(_decode_amap_polyline(bl.get("polyline", "")))
                seg_info.append({
                    "type": bl.get("type", "公交"),
                    "name": bl.get("name", ""),
                })
        cost_raw = best.get("cost")
        if isinstance(cost_raw, dict):
            transit_fee = float(cost_raw.get("transit_fee") or 0)
        else:
            try:
                transit_fee = float(cost_raw) if cost_raw is not None else 0.0
            except (TypeError, ValueError):
                transit_fee = 0.0
        out = {
            "duration": int(best.get("duration", 0)),
            "walking_distance": int(best.get("walking_distance", 0)),
            "cost": transit_fee,
            "segments": seg_info,
            "polyline": full_path,
        }
        if not full_path:
            logger.warning(
                "高德公交规划返回方案但 polyline 为空: city=%s segments=%s",
                city,
                len(best.get("segments") or []),
            )
            return None
        logger.info(
            "高德公交规划成功: city=%s polyline点数=%s duration=%s",
            city,
            len(full_path),
            out["duration"],
        )
        return out
    except Exception as exc:
        logger.warning("高德公交路线规划异常: %s", exc)
    return None


async def _get_amap_walking_route(
    origin: Dict[str, float], destination_coord: Dict[str, float]
) -> Optional[Dict[str, Any]]:
    """调用高德步行路线规划 API，作为公交路线的兜底方案。"""
    if not settings.amap_web_service_key:
        logger.warning("高德步行规划跳过: 未配置 AMAP_WEB_SERVICE_KEY")
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
        if data.get("status") != "1":
            logger.warning(
                "高德步行规划 API 非成功: status=%s infocode=%s info=%s",
                data.get("status"),
                data.get("infocode"),
                data.get("info"),
            )
            return None
        paths = (data.get("route") or {}).get("paths") or []
        if not paths:
            logger.warning("高德步行规划无 paths")
            return None
        best = paths[0]
        full_path: List[Dict[str, float]] = []
        for step in best.get("steps") or []:
            full_path.extend(_decode_amap_polyline(step.get("polyline", "")))
        if not full_path:
            logger.warning("高德步行规划返回但 polyline 为空")
            return None
        logger.info("高德步行规划成功: polyline点数=%s", len(full_path))
        return {
            "duration": int(best.get("duration", 0)),
            "walking_distance": int(best.get("distance", 0)),
            "cost": 0.0,
            "segments": [{"type": "步行", "name": "步行路线"}],
            "polyline": full_path,
        }
    except Exception as exc:
        logger.warning("高德步行路线规划异常: %s", exc)
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
    entity: Literal["attraction", "hotel", "restaurant"] = "attraction",
) -> Dict[str, float]:
    """综合坐标：PG 向量表（按城市过滤）→ 高德多策略 → 城市中心 → 伪坐标。"""
    keyword = _extract_search_keyword(name or "", location or "", city)
    if len(keyword) >= 2:
        if entity == "hotel":
            coord = await pg_vector_store.lookup_hotel_coord(keyword, city)
        elif entity == "restaurant":
            coord = await pg_vector_store.lookup_restaurant_coord(keyword, city)
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


def _normalize_entity_id(raw: Any) -> str:
    """PG 主键多为 TEXT；Mongo/JSON 可能为 int 或 '123.0'，统一为稳定字符串。"""
    if raw is None or isinstance(raw, bool):
        return ""
    if isinstance(raw, int):
        return str(raw)
    if isinstance(raw, float):
        if raw == int(raw):
            return str(int(raw))
        return str(raw).strip()
    s = str(raw).strip()
    if not s:
        return ""
    try:
        f = float(s)
        if f == int(f) and ("." in s or "e" in s.lower()):
            return str(int(f))
    except ValueError:
        pass
    return s


def _normalized_text(value: Any) -> str:
    """将 None/None 字符串等统一视为缺失文本。"""
    if value is None:
        return ""
    s = str(value).strip()
    if not s:
        return ""
    if s.lower() in _PLACEHOLDER_NULL_TEXT:
        return ""
    return s


def _is_placeholder_title(title: str, from_kind: str, entity_id: str) -> bool:
    """识别前端/兜底占位标题，命中 PG 后应被真实名称覆盖。"""
    t = _normalized_text(title)
    if not t or t in {"地点", "未知地点", "—"}:
        return True
    if entity_id:
        expected = {
            "restaurant": f"餐厅（{entity_id}）",
            "hotel": f"酒店（{entity_id}）",
            "recommendation": f"景点（{entity_id}）",
        }.get(from_kind)
        if expected and t == expected:
            return True
    if from_kind == "restaurant" and re.fullmatch(r"餐厅（.+）", t):
        return True
    if from_kind == "hotel" and re.fullmatch(r"酒店（.+）", t):
        return True
    if from_kind == "recommendation" and re.fullmatch(r"景点（.+）", t):
        return True
    return False


def _resolve_from_kind_and_id(act: Dict[str, Any]) -> tuple[str, str]:
    """解析活动的 from + id；兼容仍带 type/ref 的文档（增强接口侧）。"""
    fk = str(act.get("from", "")).strip()
    eid_s = _normalize_entity_id(act.get("id"))

    ref = act.get("ref") if isinstance(act.get("ref"), dict) else {}
    if isinstance(ref, dict):
        if not eid_s and ref.get("restaurantId"):
            eid_s = _normalize_entity_id(ref.get("restaurantId"))
            if fk not in ("recommendation", "restaurant", "hotel", "others"):
                fk = "restaurant"
        elif not eid_s and ref.get("attractionId"):
            eid_s = _normalize_entity_id(ref.get("attractionId"))
            if fk not in ("recommendation", "restaurant", "hotel", "others"):
                fk = "recommendation"
        elif not eid_s and ref.get("hotelId"):
            eid_s = _normalize_entity_id(ref.get("hotelId"))
            if fk not in ("recommendation", "restaurant", "hotel", "others"):
                fk = "hotel"

    if fk not in ("recommendation", "restaurant", "hotel", "others"):
        typ = str(act.get("type", ""))
        tl = typ.lower()
        if tl in ("recommendation", "restaurant", "hotel", "others"):
            fk = tl
        elif "餐厅" in typ or "美食" in typ or typ in ("咖啡厅", "茶馆", "小吃"):
            fk = "restaurant"
        elif "酒店" in typ or "住宿" in typ:
            fk = "hotel"
        elif typ and typ != "其他":
            fk = "recommendation"
        else:
            fk = "others"

    return fk, eid_s


async def enhance_trip_locations(
    trip: Dict[str, Any],
    provided_segments: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> Dict[str, Any]:
    """为行程中每个活动补充坐标，并在相邻有坐标活动间规划公交路线。

    当 provided_segments 不为空时，直接将对应天的路线注入 transitSegments，
    跳过高德 API 调用（适用于 GET 时读取生成后缓存的路线数据）。

    查询策略：
    1. 活动 `from` + `id` → PG fetch_*_by_id
    2. `others` 或无坐标 → title/location 地理编码
    """
    has_web_key = bool((settings.amap_web_service_key or "").strip())
    prov_keys = list((provided_segments or {}).keys()) if provided_segments else []
    logger.info(
        "enhance_trip_locations 开始: destination=%s days=%s has_amap_web_key=%s provided_segment_day_keys=%s",
        trip.get("destination"),
        len(trip.get("days") or []),
        has_web_key,
        prov_keys,
    )
    if not has_web_key and not (provided_segments and any(provided_segments.values())):
        logger.warning(
            "enhance_trip_locations: 未配置 AMAP_WEB_SERVICE_KEY，且未传入可用 routeSegments；"
            "将无法生成 transitSegments（Node finalize 也不会写入 Mongo routeSegments）"
        )

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
            title = _normalized_text(act.get("title"))
            location = _normalized_text(act.get("location"))
            from_kind, eid_s = _resolve_from_kind_and_id(act)

            coord: Optional[Dict[str, float]] = None
            row: Optional[Dict[str, Any]] = None
            if from_kind == "recommendation" and eid_s:
                row = await pg_vector_store.fetch_attraction_by_id(eid_s)
                if row and row.get("latitude") is not None and row.get("longitude") is not None:
                    coord = {"lat": float(row["latitude"]), "lng": float(row["longitude"])}
            elif from_kind == "hotel" and eid_s:
                row = await pg_vector_store.fetch_hotel_by_id(eid_s)
                if row and row.get("latitude") is not None and row.get("longitude") is not None:
                    coord = {"lat": float(row["latitude"]), "lng": float(row["longitude"])}
            elif from_kind == "restaurant" and eid_s:
                row = await pg_vector_store.fetch_restaurant_by_id(eid_s)
                if row and row.get("latitude") is not None and row.get("longitude") is not None:
                    coord = {"lat": float(row["latitude"]), "lng": float(row["longitude"])}

            if coord is None:
                if from_kind == "hotel":
                    entity: Literal["attraction", "hotel", "restaurant"] = "hotel"
                elif from_kind == "restaurant":
                    entity = "restaurant"
                else:
                    entity = "attraction"
                coord = await geocode_poi(title, location, destination, entity=entity)

            activity_coords.append(coord)

            enriched = {**act, "from": from_kind, "coordinate": coord}
            if eid_s:
                enriched["id"] = eid_s
            if row and eid_s and from_kind in ("recommendation", "hotel", "restaurant"):
                if _is_placeholder_title(str(enriched.get("title") or ""), from_kind, eid_s) and row.get("name"):
                    enriched["title"] = str(row["name"])
                desc = row.get("description")
                if not _normalized_text(enriched.get("description")) and desc is not None:
                    enriched["description"] = str(desc)
                loc_pg = row.get("location")
                if not _normalized_text(enriched.get("location")) and loc_pg:
                    enriched["location"] = str(loc_pg)
                loc_name = (
                    _normalized_text(enriched.get("location"))
                    or _normalized_text(enriched.get("title"))
                    or destination
                )
            else:
                loc_name = location or title or destination
            enriched["location"] = loc_name

            # PG 未命中但有主键时，避免前端标题退化为「地点」
            if (
                eid_s
                and from_kind in ("recommendation", "restaurant", "hotel")
                and not _normalized_text(enriched.get("title"))
            ):
                label = {"restaurant": "餐厅", "hotel": "酒店", "recommendation": "景点"}.get(
                    from_kind, "地点"
                )
                enriched["title"] = f"{label}（{eid_s}）"

            enhanced_activities.append(enriched)

            if loc_name not in seen:
                seen.add(loc_name)
                all_locations.append({"name": loc_name, "coordinate": coord})

        # ---- 步骤 2: 相邻活动间公交路线规划 ----
        day_key = str(day.get("day", ""))
        cached_segs = (provided_segments or {}).get(day_key)
        # 兼容 day 为数字时前端传 "1" 与缓存键不一致
        if cached_segs is None and day.get("day") is not None:
            alt_key = str(int(day["day"])) if isinstance(day["day"], (int, float)) and day["day"] == int(day["day"]) else None
            if alt_key and alt_key != day_key:
                cached_segs = (provided_segments or {}).get(alt_key)

        transit_segments: List[Dict[str, Any]] = []
        indexed_with_coord = [
            (i, act, coord)
            for i, (act, coord) in enumerate(zip(enhanced_activities, activity_coords))
            if coord is not None
        ]

        if cached_segs:
            # 直接使用缓存路线，不调用高德 API
            transit_segments = list(cached_segs)
            logger.info(
                "day=%s 使用缓存 routeSegments: day_key=%s 段数=%s",
                day.get("day"),
                day_key,
                len(transit_segments),
            )
        else:
            leg_count = max(0, len(indexed_with_coord) - 1)
            logger.info(
                "day=%s 规划路线: day_key=%s 有坐标活动数=%s 相邻段数=%s city=%s",
                day.get("day"),
                day_key,
                len(indexed_with_coord),
                leg_count,
                destination,
            )
            for j in range(len(indexed_with_coord) - 1):
                i_from, act_from, coord_from = indexed_with_coord[j]
                i_to, act_to, coord_to = indexed_with_coord[j + 1]
                route = await _get_amap_transit_route(coord_from, coord_to, destination)
                src = "transit"
                # 公交路线无结果或无 polyline 时降级到步行路线
                if not route or not route.get("polyline"):
                    route = await _get_amap_walking_route(coord_from, coord_to)
                    src = "walking"
                if route and route.get("polyline"):
                    plen = len(route["polyline"])
                    transit_segments.append(
                        {
                            "fromTitle": act_from.get("title", ""),
                            "toTitle": act_to.get("title", ""),
                            "fromIndex": i_from,
                            "toIndex": i_to,
                            "route": route,
                        }
                    )
                    logger.info(
                        "day=%s 段 %s→%s: %s 成功 polyline点数=%s",
                        day.get("day"),
                        i_from,
                        i_to,
                        src,
                        plen,
                    )
                else:
                    logger.warning(
                        "day=%s 段 %s→%s: 公交与步行均无有效 polyline，不写入该段",
                        day.get("day"),
                        i_from,
                        i_to,
                    )

        day_out: Dict[str, Any] = {**day, "activities": enhanced_activities}
        if transit_segments:
            day_out["transitSegments"] = transit_segments
        else:
            logger.warning(
                "day=%s 无 transitSegments（缓存为空且实时规划未得到任何折线）",
                day.get("day"),
            )
        enhanced_days.append(day_out)

    out: Dict[str, Any] = {
        "destination": destination,
        "days": enhanced_days,
        "allLocations": all_locations,
    }
    if trip.get("hotelNightlyCost") is not None:
        out["hotelNightlyCost"] = trip.get("hotelNightlyCost")
    if trip.get("hotelTotalCost") is not None:
        out["hotelTotalCost"] = trip.get("hotelTotalCost")
    hid = str(trip.get("selectedHotelId") or "").strip()
    if hid:
        hrow = await pg_vector_store.fetch_hotel_by_id(hid)
        if hrow:
            nightly = trip.get("hotelNightlyCost")
            if nightly is None and hrow.get("price_yuan") is not None:
                try:
                    nightly = int(float(hrow["price_yuan"]))
                except (TypeError, ValueError):
                    nightly = None
            out["selectedHotel"] = _json_safe(
                {
                    "hotelId": hid,
                    "name": hrow.get("name"),
                    "cost": nightly,
                    "rating": float(hrow["rating"]) if hrow.get("rating") is not None else None,
                    "priceDisplay": hrow.get("price_display"),
                    "address": hrow.get("address"),
                    "positionDesc": hrow.get("position_desc"),
                    "imageUrl": hrow.get("image_url"),
                }
            )
    days_with_routes = sum(1 for d in enhanced_days if d.get("transitSegments"))
    logger.info(
        "enhance_trip_locations 结束: 总天数=%s 含transitSegments的天数=%s",
        len(enhanced_days),
        days_with_routes,
    )
    return _json_safe(out)
