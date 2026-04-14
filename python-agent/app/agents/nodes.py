from __future__ import annotations

import json
from typing import Any, Dict

from ..model_router import model_router
from ..services.trip_tools import (
    build_candidate_attractions,
    build_day_skeleton,
    build_trip_response,
    choose_hotel,
)
from .state import AgentState


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
    return {"plan": plan}


async def retrieval_agent(state: AgentState) -> AgentState:
    req = state["request"]
    attractions = build_candidate_attractions(req["destination"], req.get("interests", ""))
    return {"candidate_attractions": attractions}


async def route_agent(state: AgentState) -> AgentState:
    req = state["request"]
    day_skeleton = build_day_skeleton(req["startDate"], req["endDate"], req["destination"])
    return {"day_skeleton": day_skeleton}


async def budget_agent(state: AgentState) -> AgentState:
    req = state["request"]
    hotel = choose_hotel(req["destination"], int(req["budget"]))
    return {
        "selected_hotel": hotel,
        "cost_summary": {
            "budget": req["budget"],
            "hotelNightly": hotel["cost"],
        },
    }


async def writer_agent(state: AgentState) -> AgentState:
    req = state["request"]
    attractions = state.get("candidate_attractions", [])
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

    return {"final_trip": final_trip}
