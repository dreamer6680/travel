from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from ..services.routing_service import haversine_km


# ---------------------------------------------------------------------------
# 默认候选数据（向量库为空时的兜底）
# ---------------------------------------------------------------------------

DEFAULT_ATTRACTIONS: List[Dict[str, str]] = [
    {"name": "城市地标观景台", "type": "景点", "description": "城市全景与拍照打卡"},
    {"name": "历史文化街区", "type": "景点", "description": "深度体验当地文化与建筑"},
    {"name": "核心商圈购物区", "type": "购物", "description": "品牌购物与夜间休闲"},
    {"name": "自然风景公园", "type": "景点", "description": "休闲漫步，亲近自然"},
    {"name": "博物馆与艺术馆", "type": "文化", "description": "了解当地历史与艺术"},
    {"name": "特色民俗村落", "type": "文化", "description": "体验地道民俗风情"},
]

DEFAULT_RESTAURANTS: List[Dict[str, str]] = [
    {"name": "本地人气美食街", "type": "小吃", "description": "品尝地道风味与特色小吃"},
    {"name": "特色风味餐厅", "type": "中餐", "description": "当地传统菜系精华"},
    {"name": "夜市烧烤广场", "type": "烧烤", "description": "夜市文化与街头美食"},
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


def build_candidate_restaurants(destination: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for idx, base in enumerate(DEFAULT_RESTAURANTS):
        rows.append(
            {
                "id": idx + 1,
                "name": f"{destination}{base['name']}",
                "type": base["type"],
                "description": base["description"],
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
# 辅助
# ---------------------------------------------------------------------------

def _recommendation_list_item(a: Dict[str, Any]) -> Dict[str, Any]:
    item: Dict[str, Any] = {"name": a["name"], "type": a.get("type", "景点")}
    aid = a.get("attraction_id")
    if aid is not None and str(aid).strip():
        item["attractionId"] = str(aid).strip()
    rid = a.get("restaurant_id")
    if rid is not None and str(rid).strip():
        item["restaurantId"] = str(rid).strip()
    return item


def _ref_from_entity(entity: Optional[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    """绑定 PG 向量表主键。"""
    if not entity:
        return None
    aid = entity.get("attraction_id")
    if aid is not None and str(aid).strip():
        return {"attractionId": str(aid).strip()}
    hid = entity.get("hotel_id")
    if hid is not None and str(hid).strip():
        return {"hotelId": str(hid).strip()}
    rid = entity.get("restaurant_id")
    if rid is not None and str(rid).strip():
        return {"restaurantId": str(rid).strip()}
    return None


_LUNCH_TITLES = ["午餐·附近特色餐厅", "午餐·地道风味小馆", "午餐·本地人气餐厅"]
_DINNER_TITLES = ["晚餐与夜游体验", "品尝当地风味晚餐", "夜市小吃与休闲夜游"]


# ---------------------------------------------------------------------------
# 景点按天分配 + 餐厅按邻近度匹配
# ---------------------------------------------------------------------------

def _nearest_restaurant(
    anchor: Optional[Dict[str, Any]],
    candidates: List[Dict[str, Any]],
    used: set,
) -> Optional[Dict[str, Any]]:
    """从候选餐厅中选出最接近 anchor 坐标的未用餐厅。"""
    if not candidates:
        return None
    available = [r for r in candidates if id(r) not in used]
    if not available:
        # 候选池用完时允许重复
        available = candidates

    if anchor and anchor.get("latitude") and anchor.get("longitude"):
        a_lat = float(anchor["latitude"])
        a_lng = float(anchor["longitude"])
        best = min(
            available,
            key=lambda r: haversine_km(
                a_lat, a_lng,
                float(r.get("latitude") or a_lat),
                float(r.get("longitude") or a_lng),
            ),
        )
    else:
        best = available[0]

    used.add(id(best))
    return best


def _distribute_attractions(
    attractions: List[Dict[str, Any]],
    restaurants: List[Dict[str, Any]],
    total_days: int,
) -> List[Dict[str, Any]]:
    """景点和餐厅分离后按天分配。

    每天结构：
    - 上午景点（match_score 最高，经路线优化排序）
    - 下午景点
    - 午餐餐厅（最靠近上午景点）
    - 晚餐餐厅（最靠近下午景点）
    """
    sightseeing = sorted(attractions, key=lambda x: x.get("match_score", 0), reverse=True)
    rest_pool = sorted(restaurants, key=lambda x: x.get("match_score", 0), reverse=True)
    used_restaurants: set = set()

    result: List[Dict[str, Any]] = []
    slots_per_day = 2
    for day_idx in range(total_days):
        morning_idx = (day_idx * slots_per_day) % max(len(sightseeing), 1)
        afternoon_idx = (day_idx * slots_per_day + 1) % max(len(sightseeing), 1)
        morning = sightseeing[morning_idx] if sightseeing else None
        afternoon = sightseeing[afternoon_idx] if sightseeing else None

        # 午餐选最靠近上午景点的餐厅，晚餐选最靠近下午景点的餐厅
        lunch = _nearest_restaurant(morning, rest_pool, used_restaurants)
        dinner = _nearest_restaurant(afternoon, rest_pool, used_restaurants)

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
    """按 上午景点 → 午餐 → 下午景点 → 晚餐 生成当天活动列表。"""
    activities: List[Dict[str, Any]] = []
    morning = day_slots.get("morning")
    afternoon = day_slots.get("afternoon")
    lunch = day_slots.get("lunch")
    dinner = day_slots.get("dinner")

    # —— 上午景点 ——
    if morning:
        row: Dict[str, Any] = {
            "time": "09:00 - 11:30",
            "title": morning["name"],
            "type": morning.get("type", "景点"),
            "description": str(morning.get("description", "")),
            "location": str(morning.get("location", destination)),
        }
        r = _ref_from_entity(morning)
        if r:
            row["ref"] = r
        activities.append(row)

    # —— 午餐 ——
    lunch_location = str(morning.get("location", destination)) if morning else destination
    if lunch:
        row = {
            "time": "12:00 - 13:30",
            "title": lunch["name"],
            "type": lunch.get("type", "餐厅"),
            "description": str(lunch.get("description", "品尝当地特色风味")),
            "location": str(lunch.get("location", lunch_location)),
        }
        if lunch.get("price_yuan"):
            row["priceYuan"] = int(lunch["price_yuan"])
        r = _ref_from_entity(lunch)
        if r:
            row["ref"] = r
        activities.append(row)
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
        row = {
            "time": "14:00 - 17:00",
            "title": afternoon["name"],
            "type": afternoon.get("type", "景点"),
            "description": str(afternoon.get("description", "")),
            "location": str(afternoon.get("location", destination)),
        }
        r = _ref_from_entity(afternoon)
        if r:
            row["ref"] = r
        activities.append(row)

    # —— 晚餐 ——
    dinner_location = str(afternoon.get("location", destination)) if afternoon else destination
    dinner_title = _DINNER_TITLES[(day_num - 1) % len(_DINNER_TITLES)]
    if dinner:
        row = {
            "time": "19:00 - 21:00",
            "title": dinner["name"],
            "type": dinner.get("type", "餐厅"),
            "description": str(dinner.get("description", "享用当地特色晚餐")),
            "location": str(dinner.get("location", dinner_location)),
        }
        if dinner.get("price_yuan"):
            row["priceYuan"] = int(dinner["price_yuan"])
        r = _ref_from_entity(dinner)
        if r:
            row["ref"] = r
        activities.append(row)
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
# 构建备选推荐池
# ---------------------------------------------------------------------------

def _build_alternatives(
    all_attractions: List[Dict[str, Any]],
    selected_attraction_ids: set,
    all_hotels: List[Dict[str, Any]],
    selected_hotel_id: Optional[str],
    all_restaurants: List[Dict[str, Any]],
    selected_restaurant_ids: set,
) -> Dict[str, Any]:
    """从候选池中排除已选中的实体，返回备选推荐列表。"""
    alt_attractions = []
    for a in all_attractions:
        aid = str(a.get("attraction_id") or "").strip()
        if not aid:
            continue  # skip fallback entries without a real ID
        if aid in selected_attraction_ids:
            continue
        alt_attractions.append({
            "attractionId": aid,
            "name": a.get("name", ""),
            "type": a.get("type", "景点"),
            "rating": float(a.get("rating") or 0) or None,
            "location": a.get("location"),
            "description": str(a.get("description", ""))[:80],
        })
        if len(alt_attractions) >= 8:
            break

    alt_hotels = []
    for h in all_hotels:
        hid = str(h.get("hotel_id") or "").strip()
        if not hid:
            continue  # fallback hotels without a real ID are skipped
        if hid == selected_hotel_id:
            continue
        alt_hotels.append({
            "hotelId": hid,
            "name": h.get("name", ""),
            "rating": float(h.get("rating") or 0) or None,
            "cost": int(h.get("cost") or 0) or None,
            "location": h.get("location"),
        })
        if len(alt_hotels) >= 5:
            break

    alt_restaurants = []
    for r in all_restaurants:
        rid = str(r.get("restaurant_id") or "").strip()
        if not rid:
            continue  # skip fallback entries without a real ID
        if rid in selected_restaurant_ids:
            continue
        alt_restaurants.append({
            "restaurantId": rid,
            "name": r.get("name", ""),
            "type": r.get("type"),
            "rating": float(r.get("rating") or 0) or None,
            "priceYuan": r.get("price_yuan"),
            "location": r.get("location"),
        })
        if len(alt_restaurants) >= 8:
            break

    return {
        "attractions": alt_attractions,
        "hotels": alt_hotels,
        "restaurants": alt_restaurants,
    }


# ---------------------------------------------------------------------------
# 行程响应构建
# ---------------------------------------------------------------------------

def build_trip_response(
    request: Dict[str, Any],
    attractions: List[Dict[str, Any]],
    restaurants: List[Dict[str, Any]],
    selected_hotel: Dict[str, Any],
    day_skeleton: List[Dict[str, Any]],
    all_attractions: Optional[List[Dict[str, Any]]] = None,
    all_hotels: Optional[List[Dict[str, Any]]] = None,
    all_restaurants: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """构建完整行程响应结构。

    - attractions: 经路线优化排序后的景点列表
    - restaurants: 经地理编码的餐厅候选列表
    - all_*: 完整候选池（用于构建 alternatives），不传则跳过
    """
    total_days = len(day_skeleton)
    distributed = _distribute_attractions(attractions, restaurants, total_days)

    days: List[Dict[str, Any]] = []
    for day in day_skeleton:
        day_num = day["day"]
        day_idx = day_num - 1
        day_slots = distributed[day_idx] if day_idx < len(distributed) else {}
        activities = build_day_activities(day_num, day_slots, request["destination"])
        days.append({"day": day_num, "title": day["title"], "activities": activities})

    # 收集已选中的实体 ID（用于排除到 alternatives 外）
    selected_attraction_ids: set = set()
    selected_restaurant_ids: set = set()
    for slot in distributed:
        for key in ("morning", "afternoon"):
            e = slot.get(key)
            if e:
                aid = str(e.get("attraction_id") or "").strip()
                if aid:
                    selected_attraction_ids.add(aid)
        for key in ("lunch", "dinner"):
            e = slot.get(key)
            if e:
                rid = str(e.get("restaurant_id") or "").strip()
                if rid:
                    selected_restaurant_ids.add(rid)

    selected_hotel_id = str(selected_hotel.get("hotel_id") or "").strip() or None

    # 构建备选推荐
    alternatives = _build_alternatives(
        all_attractions=all_attractions or attractions,
        selected_attraction_ids=selected_attraction_ids,
        all_hotels=all_hotels or [],
        selected_hotel_id=selected_hotel_id,
        all_restaurants=all_restaurants or restaurants,
        selected_restaurant_ids=selected_restaurant_ids,
    )

    # 预算分配
    budget = int(request.get("budget", 10000))
    travelers = int(request.get("travelers", 2))
    hotel_nightly = int(selected_hotel.get("cost", 500))
    hotel_total = hotel_nightly * total_days
    transport_budget = max(int(budget * 0.15), 200)
    food_budget = max(int(budget * 0.25), 300)

    selected_hotel_payload = dict(selected_hotel)
    hid = selected_hotel.get("hotel_id")
    if hid is not None and str(hid).strip():
        selected_hotel_payload["hotelId"] = str(hid).strip()
    selected_hotel_payload["totalCost"] = hotel_total
    selected_hotel_payload["priceDisplay"] = (
        selected_hotel.get("price_display") or f"¥{hotel_nightly}/晚"
    )
    if selected_hotel.get("rating"):
        selected_hotel_payload["rating"] = float(selected_hotel["rating"])
    if selected_hotel.get("address"):
        selected_hotel_payload["address"] = selected_hotel["address"]
    if selected_hotel.get("position_desc"):
        selected_hotel_payload["positionDesc"] = selected_hotel["position_desc"]
    if selected_hotel.get("image_url"):
        selected_hotel_payload["imageUrl"] = selected_hotel["image_url"]

    estimated_cost = hotel_total + transport_budget + food_budget

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
        "recommendations": [_recommendation_list_item(a) for a in attractions[:6]],
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
        "estimatedCost": estimated_cost,
        "selectedHotel": selected_hotel_payload,
        "alternatives": alternatives,
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
