from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4


# ---------------------------------------------------------------------------
# 默认候选数据（向量库为空时的兜底）
# ---------------------------------------------------------------------------

DEFAULT_ATTRACTIONS: List[Dict[str, str]] = [
    {"name": "城市地标观景台", "type": "景点", "description": "城市全景与拍照打卡"},
    {"name": "历史文化街区", "type": "景点", "description": "深度体验当地文化与建筑"},
    {"name": "本地人气美食街", "type": "餐厅", "description": "品尝地道风味与特色小吃"},
    {"name": "核心商圈购物区", "type": "购物", "description": "品牌购物与夜间休闲"},
    {"name": "自然风景公园", "type": "景点", "description": "休闲漫步，亲近自然"},
    {"name": "博物馆与艺术馆", "type": "文化", "description": "了解当地历史与艺术"},
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
                "rating": round(4.0 + idx * 0.1, 1),
                "match_score": 0.5,
            }
        )
    return rows


def choose_hotel(destination: str, budget: int) -> Dict[str, Any]:
    nightly = max(300, min(int(budget * 0.12), 1800))
    return {
        "name": f"{destination}中心精选酒店",
        "cost": nightly,
        "location": destination,
        "latitude": None,
        "longitude": None,
        "match_score": 0.5,
        "rating": 4.2,
    }


# ---------------------------------------------------------------------------
# 行程骨架
# ---------------------------------------------------------------------------

def build_day_skeleton(start_date: str, end_date: str, destination: str) -> List[Dict[str, Any]]:
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    total_days = max((end - start).days + 1, 1)
    skeleton: List[Dict[str, Any]] = []
    for i in range(total_days):
        day_index = i + 1
        skeleton.append(
            {
                "day": day_index,
                "title": f"第{day_index}天·{destination}深度体验",
                "time_slots": ["上午", "下午", "晚上"],
            }
        )
    return skeleton


# ---------------------------------------------------------------------------
# 景点分配：按天均分 + 按 match_score 优先
# ---------------------------------------------------------------------------

_RESTAURANT_TYPES = {"餐厅", "咖啡厅", "茶馆", "小吃", "美食"}

_LUNCH_TITLES = [
    "午餐·附近特色餐厅",
    "午餐·地道风味小馆",
    "午餐·本地人气餐厅",
]
_DINNER_TITLES = [
    "晚餐与夜游体验",
    "品尝当地风味晚餐",
    "夜市小吃与休闲夜游",
]


def _is_restaurant(attr: Dict[str, Any]) -> bool:
    return str(attr.get("type", "")).strip() in _RESTAURANT_TYPES


def _distribute_attractions(
    attractions: List[Dict[str, Any]], total_days: int
) -> List[Dict[str, Any]]:
    """将景点和餐厅分开，按 match_score 降序后按天分配。

    每天结构：
    - 上午景点 (slot 0)
    - 下午景点 (slot 1)
    - 可选午餐餐厅（来自 restaurants 池，与上午景点同区域）
    - 可选晚餐餐厅

    返回 dict: {day_idx: {morning, afternoon, lunch, dinner}}
    """
    sightseeing = sorted(
        [a for a in attractions if not _is_restaurant(a)],
        key=lambda x: x.get("match_score", 0),
        reverse=True,
    )
    restaurants = sorted(
        [a for a in attractions if _is_restaurant(a)],
        key=lambda x: x.get("match_score", 0),
        reverse=True,
    )

    result: List[Dict[str, Any]] = []
    slots_per_day = 2
    for day_idx in range(total_days):
        morning_idx = (day_idx * slots_per_day) % max(len(sightseeing), 1)
        afternoon_idx = (day_idx * slots_per_day + 1) % max(len(sightseeing), 1)
        morning = sightseeing[morning_idx] if sightseeing else None
        afternoon = sightseeing[afternoon_idx] if sightseeing else None

        # 从餐厅池中为午餐/晚餐分配，优先选与上午景点位置相近的（如有坐标）
        lunch_idx = (day_idx * 2) % max(len(restaurants), 1)
        dinner_idx = (day_idx * 2 + 1) % max(len(restaurants), 1)
        lunch = restaurants[lunch_idx] if restaurants else None
        dinner = restaurants[dinner_idx] if restaurants else None

        result.append(
            {
                "morning": morning,
                "afternoon": afternoon,
                "lunch": lunch,
                "dinner": dinner,
            }
        )
    return result


def build_day_activities(
    day_num: int,
    day_slots: Dict[str, Any],
    destination: str,
) -> List[Dict[str, Any]]:
    """按 上午景点 → 午餐 → 下午景点 → 晚餐 结构生成当天活动列表。

    餐厅的 location 使用附近景点的地址，提高地图精度。
    """
    activities: List[Dict[str, Any]] = []
    morning = day_slots.get("morning")
    afternoon = day_slots.get("afternoon")
    lunch = day_slots.get("lunch")
    dinner = day_slots.get("dinner")

    # —— 上午景点 ——
    if morning:
        activities.append(
            {
                "time": "09:00 - 11:30",
                "title": morning["name"],
                "type": morning.get("type", "景点"),
                "description": str(morning.get("description", "")),
                "location": str(morning.get("location", destination)),
            }
        )

    # —— 午餐 ——
    # 使用真实餐厅数据（有坐标），否则用上午景点附近的通用描述
    lunch_location = str(morning.get("location", destination)) if morning else destination
    if lunch:
        activities.append(
            {
                "time": "12:00 - 13:30",
                "title": lunch["name"],
                "type": "餐厅",
                "description": str(lunch.get("description", "品尝当地特色风味")),
                "location": str(lunch.get("location", lunch_location)),
            }
        )
    else:
        lunch_title = _LUNCH_TITLES[(day_num - 1) % len(_LUNCH_TITLES)]
        activities.append(
            {
                "time": "12:00 - 13:30",
                "title": f"{destination}{lunch_title}",
                "type": "餐厅",
                "description": "就近享用午餐，品味当地特色风味小食。",
                "location": lunch_location,
            }
        )

    # —— 下午景点 ——
    if afternoon:
        activities.append(
            {
                "time": "14:00 - 17:00",
                "title": afternoon["name"],
                "type": afternoon.get("type", "景点"),
                "description": str(afternoon.get("description", "")),
                "location": str(afternoon.get("location", destination)),
            }
        )

    # —— 晚餐 ——
    dinner_location = str(afternoon.get("location", destination)) if afternoon else destination
    dinner_title = _DINNER_TITLES[(day_num - 1) % len(_DINNER_TITLES)]
    if dinner:
        activities.append(
            {
                "time": "19:00 - 21:00",
                "title": dinner["name"],
                "type": "餐厅",
                "description": str(dinner.get("description", "享用当地特色晚餐")),
                "location": str(dinner.get("location", dinner_location)),
            }
        )
    else:
        activities.append(
            {
                "time": "19:00 - 21:00",
                "title": f"{destination}{dinner_title}",
                "type": "餐厅",
                "description": "品尝当地特色晚餐，探索附近夜生活与夜市文化。",
                "location": dinner_location,
            }
        )
    return activities


# ---------------------------------------------------------------------------
# 行程响应构建
# ---------------------------------------------------------------------------

def build_trip_response(
    request: Dict[str, Any],
    attractions: List[Dict[str, Any]],
    selected_hotel: Dict[str, Any],
    day_skeleton: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """构建完整行程响应结构。

    改进点（相比原版 round-robin）：
    - 按 match_score 降序排列景点后均匀分配
    - 每天活动带 location 字段
    - 包含酒店住宿信息
    - practicalInfo 使用真实预算比例
    """
    total_days = len(day_skeleton)
    distributed = _distribute_attractions(attractions, total_days)

    days: List[Dict[str, Any]] = []
    for day in day_skeleton:
        day_num = day["day"]
        day_idx = day_num - 1
        day_slots = distributed[day_idx] if day_idx < len(distributed) else {}
        activities = build_day_activities(day_num, day_slots, request["destination"])
        days.append({"day": day_num, "title": day["title"], "activities": activities})

    # 预算分配
    budget = int(request.get("budget", 10000))
    travelers = int(request.get("travelers", 2))
    hotel_nightly = int(selected_hotel.get("cost", 500))
    hotel_total = hotel_nightly * total_days
    transport_budget = max(int(budget * 0.15), 200)
    food_budget = max(int(budget * 0.25), 300)

    result: Dict[str, Any] = {
        "id": uuid4().hex[:12],
        "title": f"{request['destination']}个性化行程",
        "destination": request["destination"],
        "startDate": request["startDate"],
        "endDate": request["endDate"],
        "travelers": travelers,
        "budget": budget,
        "travelStyle": request.get("travelStyle", "balanced"),
        "status": "confirmed",
        "highlights": [a["name"] for a in attractions[:6]],
        "days": days,
        "recommendations": [
            {"name": a["name"], "type": a.get("type", "景点")}
            for a in attractions[:6]
        ],
        "practicalInfo": {
            "transportation": [
                {"name": "地铁/公交", "cost": int(transport_budget * 0.5), "icon": "Train"},
                {"name": "出租车/网约车", "cost": int(transport_budget * 0.5), "icon": "Taxi"},
            ],
            "accommodation": [
                {
                    "name": selected_hotel["name"],
                    "cost": hotel_nightly,
                    "totalCost": hotel_total,
                    "nights": total_days,
                    "icon": "Hotel",
                }
            ],
            "food": [
                {"name": "餐饮预算", "cost": food_budget, "icon": "Utensils"},
            ],
            "tips": [
                "热门景点建议提前在线预约，节假日尤为重要。",
                "高峰时段优先选择地铁等公共交通，节省时间。",
                "每天行程保留 1-2 小时机动时间，应对突发情况。",
                "随身携带城市地图或提前下载离线地图。",
            ],
        },
        "selectedHotel": selected_hotel,
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }

    # 保证 description 为字符串
    for day in result["days"]:
        for act in day.get("activities", []):
            if isinstance(act.get("description"), list):
                act["description"] = "，".join(str(x) for x in act["description"])
            elif act.get("description") is None:
                act["description"] = ""
            else:
                act["description"] = str(act["description"])

    return result
