from __future__ import annotations

import math
from typing import Dict, List


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


def estimate_route_cost(hotel: Dict, attractions: List[Dict]) -> Dict:
    if not attractions:
        return {"distance_km": 0.0, "duration_min": 0.0}
    h_lat = float(hotel.get("latitude", 0))
    h_lng = float(hotel.get("longitude", 0))
    points = [(h_lat, h_lng)]
    for a in attractions:
        points.append((float(a.get("latitude", 0)), float(a.get("longitude", 0))))
    points.append((h_lat, h_lng))

    total_km = 0.0
    for i in range(len(points) - 1):
        total_km += haversine_km(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])

    # 估算城市平均时速 22km/h
    duration_min = (total_km / 22.0) * 60.0
    return {"distance_km": round(total_km, 2), "duration_min": round(duration_min, 1)}
