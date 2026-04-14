from __future__ import annotations

import math
from typing import Dict, List, Tuple


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def nearest_neighbor_sort(
    hotel: Dict, attractions: List[Dict]
) -> List[Dict]:
    """最近邻贪心排序（近似 TSP）。

    从酒店出发，每次选取离当前位置最近的未访问景点，
    降低每日总行程距离。对应 v2 route-planning-service 的路线优化。
    """
    if not attractions:
        return []

    remaining = list(attractions)
    ordered: List[Dict] = []
    cur_lat = float(hotel.get("latitude") or 0)
    cur_lng = float(hotel.get("longitude") or 0)

    while remaining:
        best_idx = 0
        best_dist = float("inf")
        for i, a in enumerate(remaining):
            a_lat = float(a.get("latitude") or cur_lat)
            a_lng = float(a.get("longitude") or cur_lng)
            d = haversine_km(cur_lat, cur_lng, a_lat, a_lng)
            if d < best_dist:
                best_dist = d
                best_idx = i
        chosen = remaining.pop(best_idx)
        ordered.append(chosen)
        cur_lat = float(chosen.get("latitude") or cur_lat)
        cur_lng = float(chosen.get("longitude") or cur_lng)

    return ordered


def estimate_route_cost(hotel: Dict, attractions: List[Dict]) -> Dict:
    """计算经过所有景点再返回酒店的总距离与估算时长（城市平均时速 22 km/h）。"""
    if not attractions:
        return {"distance_km": 0.0, "duration_min": 0.0}

    h_lat = float(hotel.get("latitude", 0))
    h_lng = float(hotel.get("longitude", 0))
    points: List[Tuple[float, float]] = [(h_lat, h_lng)]
    for a in attractions:
        points.append((float(a.get("latitude", 0)), float(a.get("longitude", 0))))
    points.append((h_lat, h_lng))

    total_km = 0.0
    for i in range(len(points) - 1):
        total_km += haversine_km(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])

    duration_min = (total_km / 22.0) * 60.0
    return {"distance_km": round(total_km, 2), "duration_min": round(duration_min, 1)}
