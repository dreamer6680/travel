from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List
from uuid import uuid4


DEFAULT_ATTRACTIONS: List[Dict[str, str]] = [
    {"name": "城市地标观景台", "type": "景点", "description": "城市全景与拍照打卡"},
    {"name": "历史文化街区", "type": "景点", "description": "深度体验当地文化与建筑"},
    {"name": "本地人气美食街", "type": "餐厅", "description": "品尝地道风味与特色小吃"},
    {"name": "核心商圈购物区", "type": "购物", "description": "品牌购物与夜间休闲"},
]


def build_candidate_attractions(destination: str, interests: str) -> List[Dict[str, Any]]:
    tags = [item.strip() for item in interests.replace("，", ",").split(",") if item.strip()]
    rows: List[Dict[str, Any]] = []
    for idx, base in enumerate(DEFAULT_ATTRACTIONS):
        rows.append(
            {
                "id": idx + 1,
                "name": f"{destination}{base['name']}",
                "type": base["type"],
                "description": f"{base['description']}；兴趣偏好：{', '.join(tags) if tags else '通用'}",
                "location": destination,
                "rating": 4.2 + (idx * 0.1),
            }
        )
    return rows


def choose_hotel(destination: str, budget: int) -> Dict[str, Any]:
    nightly = max(300, min(int(budget * 0.12), 1800))
    return {
        "name": f"{destination}中心精选酒店",
        "cost": nightly,
        "latitude": 31.2304,
        "longitude": 121.4737,
    }


def build_day_skeleton(start_date: str, end_date: str, destination: str) -> List[Dict[str, Any]]:
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    days = max((end - start).days + 1, 1)
    skeleton: List[Dict[str, Any]] = []
    for i in range(days):
        day_index = i + 1
        skeleton.append(
            {
                "day": day_index,
                "title": f"第{day_index}天·{destination}深度体验",
                "time_slots": ["上午", "下午", "晚上"],
            }
        )
    return skeleton


def build_trip_response(
    request: Dict[str, Any],
    attractions: List[Dict[str, Any]],
    selected_hotel: Dict[str, Any],
    day_skeleton: List[Dict[str, Any]],
) -> Dict[str, Any]:
    days: List[Dict[str, Any]] = []
    for day in day_skeleton:
        day_num = day["day"]
        a1 = attractions[(day_num - 1) % len(attractions)]
        a2 = attractions[(day_num) % len(attractions)]
        activities = [
            {
                "time": "09:00 - 11:30",
                "title": a1["name"],
                "type": a1["type"],
                "description": a1["description"],
            },
            {
                "time": "14:00 - 17:00",
                "title": a2["name"],
                "type": a2["type"],
                "description": a2["description"],
            },
            {
                "time": "19:00 - 21:00",
                "title": f"{request['destination']}夜游与美食",
                "type": "休闲",
                "description": "自由活动，体验夜景与本地餐饮。",
            },
        ]
        days.append({"day": day_num, "title": day["title"], "activities": activities})

    return {
        "id": uuid4().hex[:12],
        "title": f"{request['destination']}个性化行程",
        "destination": request["destination"],
        "startDate": request["startDate"],
        "endDate": request["endDate"],
        "travelers": request["travelers"],
        "budget": request["budget"],
        "travelStyle": request["travelStyle"],
        "status": "confirmed",
        "highlights": [item["name"] for item in attractions[:4]],
        "days": days,
        "recommendations": [{"name": item["name"], "type": item["type"]} for item in attractions[:4]],
        "practicalInfo": {
            "transportation": [
                {"name": "地铁", "cost": 80, "icon": "Train"},
                {"name": "出租车", "cost": 220, "icon": "Taxi"},
            ],
            "accommodation": [
                {"name": selected_hotel["name"], "cost": selected_hotel["cost"], "icon": "Hotel"}
            ],
            "tips": [
                "热门景点建议提前预约。",
                "高峰时段优先公共交通。",
                "行程保留 1-2 小时机动时间。"
            ],
        },
        "selectedHotel": selected_hotel,
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }
