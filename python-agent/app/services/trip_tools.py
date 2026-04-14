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

_DAILY_TIME_SLOTS = [
    ("09:00 - 11:30", "上午"),
    ("14:00 - 17:00", "下午"),
    ("19:00 - 21:00", "晚上"),
]

_EVENING_ACTIVITY_TITLES = ["夜游与美食体验", "品尝当地夜宵", "夜市购物与休闲"]


def _distribute_attractions(
    attractions: List[Dict[str, Any]], total_days: int
) -> List[List[Dict[str, Any]]]:
    """将景点按 match_score 降序后均匀分配到每天，尽量不重复。

    每天分配 2 个主要景点（上午 + 下午），晚上默认为自由活动。
    若景点不足则循环使用。
    """
    sorted_attrs = sorted(attractions, key=lambda x: x.get("match_score", 0), reverse=True)
    slots_per_day = 2  # 上午 + 下午各一个景点
    result: List[List[Dict[str, Any]]] = []
    for day_idx in range(total_days):
        day_pool: List[Dict[str, Any]] = []
        for slot in range(slots_per_day):
            global_idx = day_idx * slots_per_day + slot
            attr = sorted_attrs[global_idx % len(sorted_attrs)]
            day_pool.append(attr)
        result.append(day_pool)
    return result


def build_day_activities(
    day_num: int,
    day_attractions: List[Dict[str, Any]],
    destination: str,
) -> List[Dict[str, Any]]:
    """为单天生成活动列表（上午、下午各一个景点，晚上自由活动）。"""
    activities: List[Dict[str, Any]] = []
    slot_times = [("09:00 - 11:30", "上午"), ("14:00 - 17:00", "下午")]

    for slot_idx, attr in enumerate(day_attractions[:2]):
        time_str, _ = slot_times[slot_idx]
        activities.append(
            {
                "time": time_str,
                "title": attr["name"],
                "type": attr.get("type", "景点"),
                "description": str(attr.get("description", "")),
                "location": str(attr.get("location", destination)),
            }
        )

    # 晚上固定自由活动
    evening_title = _EVENING_ACTIVITY_TITLES[(day_num - 1) % len(_EVENING_ACTIVITY_TITLES)]
    activities.append(
        {
            "time": "19:00 - 21:00",
            "title": f"{destination}{evening_title}",
            "type": "休闲",
            "description": "自由活动，体验当地夜生活、美食与文化。",
            "location": destination,
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
        day_attrs = distributed[day_idx] if day_idx < len(distributed) else []
        activities = build_day_activities(day_num, day_attrs, request["destination"])
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
