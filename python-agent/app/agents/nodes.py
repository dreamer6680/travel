from __future__ import annotations

import json
from typing import Any, Dict

from ..model_router import model_router
from ..services.data_sources import data_sources
from ..services.embedding_service import cosine_similarity, embed_text
from ..services.location_tools import geocode_name
from ..services.routing_service import estimate_route_cost
from ..services.trip_tools import (
    build_candidate_attractions,
    build_day_skeleton,
    build_trip_response,
    choose_hotel,
)
from .state import AgentState


def _as_text(value: Any, default: str = "") -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "，".join(str(item) for item in value if item is not None)
    if value is None:
        return default
    return str(value)


def _as_float(value: Any, default: float = 4.2) -> float:
    try:
        return float(value)
    except Exception:
        return default


async def planner_agent(state: AgentState) -> AgentState:
    req = state["request"]
    prompt = (
        "你是旅行 Planner Agent。请用 3-5 条简要步骤给出这次旅行规划策略。"
        f"\n目的地: {req['destination']}\n风格: {req['travelStyle']}\n兴趣: {req.get('interests', '')}"
    )
    try:
        plan = await model_router.chat_with_fallback(
            [
                {"role": "system", "content": "你是多Agent系统中的Planner，输出简洁可执行步骤。"},
                {"role": "user", "content": prompt},
            ]
        )
    except Exception:
        plan = "1)解析用户需求 2)选择候选景点 3)生成按天安排 4)校验预算 5)输出标准JSON"
    preference_text = (
        f"目的地:{req['destination']} 风格:{req['travelStyle']} 预算:{req.get('budget', 0)} "
        f"人数:{req.get('travelers', 2)} 兴趣:{req.get('interests', '')}"
    )
    preference_embedding = await embed_text(preference_text)
    return {"plan": plan, "preference_text": preference_text, "preference_embedding": preference_embedding}


async def retrieval_agent(state: AgentState) -> AgentState:
    req = state["request"]
    pref_emb = state.get("preference_embedding", [])
    attraction_rows = await data_sources.fetch_recommendations_by_embedding(
        pref_emb, req["destination"], req.get("interests", ""), 20
    )
    hotel_rows = await data_sources.fetch_hotels_by_embedding(pref_emb, req["destination"], 20)

    attractions = []
    for idx, row in enumerate(attraction_rows[:20], start=1):
        text = f"{row.get('name','')} {row.get('type','')} {row.get('description','')} {row.get('location','')}"
        sim = cosine_similarity(pref_emb, await embed_text(text))
        attractions.append(
            {
                "id": idx,
                "name": _as_text(row.get("name"), f"{req['destination']}推荐景点{idx}"),
                "type": _as_text(row.get("type"), "景点"),
                "description": _as_text(row.get("description"), "来自数据库/API的推荐结果"),
                "location": _as_text(row.get("location"), req["destination"]),
                "rating": _as_float(row.get("rating"), 4.2),
                "match_score": float(row.get("similarity") or sim),
            }
        )
    if not attractions:
        attractions = build_candidate_attractions(req["destination"], req.get("interests", ""))
        for a in attractions:
            a["match_score"] = 0.5

    hotels = []
    for idx, row in enumerate(hotel_rows[:20], start=1):
        text = f"{row.get('name','')} {row.get('description','')} {row.get('location','')}"
        sim = cosine_similarity(pref_emb, await embed_text(text))
        hotels.append(
            {
                "id": idx,
                "name": _as_text(row.get("name"), f"{req['destination']}酒店{idx}"),
                "cost": int(float(row.get("cost") or row.get("price_yuan") or row.get("priceYuan") or 500)),
                "location": _as_text(row.get("location"), req["destination"]),
                "latitude": row.get("latitude"),
                "longitude": row.get("longitude"),
                "match_score": float(row.get("similarity") or sim),
                "rating": _as_float(row.get("rating"), 4.0),
            }
        )
    if not hotels:
        default_hotel = choose_hotel(req["destination"], int(req["budget"]))
        default_hotel["match_score"] = 0.5
        default_hotel["rating"] = 4.2
        hotels = [default_hotel]

    top_attractions = sorted(attractions, key=lambda x: x.get("match_score", 0), reverse=True)[:20]
    top_hotels = sorted(hotels, key=lambda x: x.get("match_score", 0), reverse=True)[:20]
    return {
        "candidate_attractions": attractions,
        "candidate_hotels": hotels,
        "top_attractions": top_attractions,
        "top_hotels": top_hotels,
    }


async def route_agent(state: AgentState) -> AgentState:
    req = state["request"]
    top_attractions = state.get("top_attractions", [])
    top_hotels = state.get("top_hotels", [])

    geo_attractions = []
    for a in top_attractions:
        lat = a.get("latitude")
        lng = a.get("longitude")
        if lat is None or lng is None:
            geo = await geocode_name(str(a.get("location") or a.get("name")), req["destination"])
            lat, lng = geo["lat"], geo["lng"]
        geo_attractions.append({**a, "latitude": float(lat), "longitude": float(lng)})

    geo_hotels = []
    for h in top_hotels:
        lat = h.get("latitude")
        lng = h.get("longitude")
        if lat is None or lng is None:
            geo = await geocode_name(str(h.get("location") or h.get("name")), req["destination"])
            lat, lng = geo["lat"], geo["lng"]
        geo_hotels.append({**h, "latitude": float(lat), "longitude": float(lng)})

    route_candidates = []
    attraction_pool = geo_attractions[:8]
    for hotel in geo_hotels[:5]:
        route = estimate_route_cost(hotel, attraction_pool)
        route_candidates.append({"hotel": hotel, "attractions": attraction_pool, "route": route})

    day_skeleton = build_day_skeleton(req["startDate"], req["endDate"], req["destination"])
    return {
        "geo_attractions": geo_attractions,
        "geo_hotels": geo_hotels,
        "route_candidates": route_candidates,
        "day_skeleton": day_skeleton,
    }


async def budget_agent(state: AgentState) -> AgentState:
    req = state["request"]
    route_candidates = state.get("route_candidates", [])
    budget = int(req["budget"])
    travelers = int(req.get("travelers", 2))

    best = None
    best_score = -1e9
    for item in route_candidates:
        hotel = item["hotel"]
        route = item["route"]
        nightly = int(hotel.get("cost", 500))
        budget_penalty = max(0, nightly * travelers - budget * 0.25) / 500.0
        score = (
            float(hotel.get("match_score", 0)) * 1.5
            + float(hotel.get("rating", 4.0))
            - float(route.get("duration_min", 0)) / 180.0
            - budget_penalty
        )
        if score > best_score:
            best_score = score
            best = item

    if best is None:
        hotel = choose_hotel(req["destination"], int(req["budget"]))
        best = {"hotel": hotel, "attractions": state.get("geo_attractions", [])[:8], "route": {"distance_km": 0, "duration_min": 0}}

    hotel = best["hotel"]
    return {
        "selected_hotel": hotel,
        "best_plan": best,
        "cost_summary": {
            "budget": req["budget"],
            "hotelNightly": hotel["cost"],
            "route": best.get("route", {}),
        },
    }


async def writer_agent(state: AgentState) -> AgentState:
    req = state["request"]
    best_plan = state.get("best_plan", {})
    attractions = best_plan.get("attractions", state.get("top_attractions", state.get("candidate_attractions", [])))
    day_skeleton = state.get("day_skeleton", [])
    hotel = state.get("selected_hotel", {})

    draft = build_trip_response(req, attractions, hotel, day_skeleton)
    system = (
        "你是 ItineraryWriter Agent。基于输入输出最终 JSON。"
        "必须保持字段不变，不要附加解释。"
    )
    user_prompt = json.dumps(draft, ensure_ascii=False)
    try:
        content = await model_router.chat_with_fallback(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ]
        )
    except Exception:
        content = json.dumps(draft, ensure_ascii=False)

    try:
        normalized = content.replace("```json", "").replace("```", "").strip()
        final_trip: Dict[str, Any] = json.loads(normalized)
        if not isinstance(final_trip, dict):
            raise ValueError("writer output invalid")
    except Exception:
        final_trip = draft

    # 再次兜底规整，避免 response_model 校验失败
    for day in final_trip.get("days", []):
        for act in day.get("activities", []):
            if isinstance(act.get("description"), list):
                act["description"] = "，".join(str(x) for x in act["description"])
            elif not isinstance(act.get("description"), str):
                act["description"] = str(act.get("description", ""))

    return {"final_trip": final_trip}
