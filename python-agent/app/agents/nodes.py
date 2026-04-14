from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from ..model_router import model_router
from ..services.data_sources import data_sources
from ..services.embedding_service import build_preference_text, embed_text
from ..services.location_tools import geocode_name
from ..services.pg_vector_store import pg_vector_store
from ..services.routing_service import estimate_route_cost, nearest_neighbor_sort
from ..services.trip_tools import (
    build_candidate_attractions,
    build_day_skeleton,
    build_trip_response,
    choose_hotel,
)
from .state import AgentState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

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


def _select_hotel_near_attractions(
    hotels: List[Dict[str, Any]],
    attractions: List[Dict[str, Any]],
    budget: int,
) -> Dict[str, Any]:
    """选出与候选景点中心距离最近且在预算内的酒店。

    对应 v2 trip-generation-workflow 中的 selectedHotel 逻辑。
    """
    with_coord = [h for h in hotels if h.get("latitude") and h.get("longitude")]
    attr_with_coord = [
        a for a in attractions[:15] if a.get("latitude") and a.get("longitude")
    ]

    if with_coord and attr_with_coord:
        cen_lat = sum(float(a["latitude"]) for a in attr_with_coord) / len(attr_with_coord)
        cen_lng = sum(float(a["longitude"]) for a in attr_with_coord) / len(attr_with_coord)
        best = min(
            with_coord,
            key=lambda h: (float(h["latitude"]) - cen_lat) ** 2
            + (float(h["longitude"]) - cen_lng) ** 2,
        )
        return best

    # fallback: 选评分最高且价格在预算 25% 内的
    affordable = [h for h in hotels if int(h.get("cost", 0)) <= budget * 0.25] or hotels
    return max(affordable, key=lambda h: _as_float(h.get("rating"), 4.0))


# ---------------------------------------------------------------------------
# Planner Agent：解析用户需求，生成结构化规划策略 + 偏好向量
# ---------------------------------------------------------------------------

async def planner_agent(state: AgentState) -> AgentState:
    """
    负责：
    1. 用 LLM 完善并结构化用户输入（类似 v2 enhanceUserInput）
    2. 构建偏好文本并生成向量
    """
    req = state["request"]
    destination = req.get("destination", "")
    travel_style = req.get("travelStyle", "balanced")
    interests = req.get("interests", "")
    budget = req.get("budget", 10000)
    travelers = req.get("travelers", 2)
    start_date = req.get("startDate", "")
    end_date = req.get("endDate", "")

    # --- LLM 结构化需求提取 ---
    system_prompt = (
        "你是旅行 Planner Agent。请根据用户输入，以 JSON 格式输出规划策略，"
        "字段：mustVisit(必去景点列表)、preferredTypes(偏好景点类型列表)、"
        "highlights(行程亮点列表，3-5条)、planSummary(一段简短规划思路描述)。"
        "只输出 JSON，不要附加任何解释。"
    )
    user_prompt = (
        f"目的地: {destination}\n"
        f"出行风格: {travel_style}\n"
        f"兴趣偏好: {interests}\n"
        f"总预算: {budget} 元\n"
        f"出行人数: {travelers} 人\n"
        f"日期: {start_date} 至 {end_date}"
    )

    structured: Dict[str, Any] = {}
    try:
        content = await model_router.chat_with_fallback(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        )
        normalized = content.replace("```json", "").replace("```", "").strip()
        structured = json.loads(normalized)
    except Exception as exc:
        logger.warning("planner_agent LLM 解析失败，使用默认结构: %s", exc)
        structured = {
            "mustVisit": [],
            "preferredTypes": [],
            "highlights": [f"{destination}核心景点", "文化体验", "美食探索"],
            "planSummary": f"为您规划 {destination} 的个性化旅行行程",
        }

    # --- 构建偏好文本 & 向量 ---
    # 将 LLM 提取的 mustVisit/preferredTypes 合并进兴趣文本，提升检索精度
    extra_interests = []
    if structured.get("mustVisit"):
        extra_interests.extend(structured["mustVisit"][:3])
    if structured.get("preferredTypes"):
        extra_interests.extend(structured["preferredTypes"][:3])
    enriched_interests = interests
    if extra_interests:
        enriched_interests = f"{interests}，{'，'.join(extra_interests)}" if interests else "，".join(extra_interests)

    preference_text = build_preference_text(
        destination=destination,
        travel_style=travel_style,
        interests=enriched_interests,
        budget=int(budget),
        travelers=int(travelers),
    )
    preference_embedding = await embed_text(preference_text)

    logger.info("planner_agent 完成: destination=%s, pref_text=%s", destination, preference_text[:80])
    return {
        "plan": structured.get("planSummary", ""),
        "structured_requirements": structured,
        "preference_text": preference_text,
        "preference_embedding": preference_embedding,
    }


# ---------------------------------------------------------------------------
# Retrieval Agent：向量检索景点与酒店
# ---------------------------------------------------------------------------

async def retrieval_agent(state: AgentState) -> AgentState:
    """
    负责：
    1. 用偏好向量检索景点（含目的地过滤）
    2. 用偏好向量检索酒店
    3. 直接使用 pgvector 返回的 similarity 字段，不再重复 embed

    对应 v2 VectorSearchService.searchByPreferences()。
    """
    req = state["request"]
    destination = req.get("destination", "")
    interests = req.get("interests", "")
    pref_emb: List[float] = state.get("preference_embedding", [])

    # --- 检索景点 ---
    attraction_rows = await data_sources.fetch_recommendations_by_embedding(
        pref_emb, destination, interests, 20
    )

    attractions: List[Dict[str, Any]] = []
    for idx, row in enumerate(attraction_rows[:20], start=1):
        # 直接取 pgvector 返回的 similarity，无需重复 embed（原版 bug 修复）
        similarity = float(row.get("similarity") or 0.5)
        rating = _as_float(row.get("rating"), 4.2)
        # 综合匹配分：相似度 + 评分加成（对应 v2 matchScore 计算）
        match_score = min(similarity + (rating - 3.5) / 20.0, 1.0)

        attractions.append(
            {
                "id": idx,
                "attraction_id": row.get("attraction_id"),
                "name": _as_text(row.get("name"), f"{destination}推荐景点{idx}"),
                "type": _as_text(row.get("type"), "景点"),
                "description": _as_text(row.get("description"), "推荐景点"),
                "location": _as_text(row.get("location"), destination),
                "rating": rating,
                "latitude": row.get("latitude"),
                "longitude": row.get("longitude"),
                "similarity": similarity,
                "match_score": match_score,
            }
        )

    if not attractions:
        logger.warning("向量检索景点为空，使用候选兜底")
        attractions = build_candidate_attractions(destination, interests)

    # --- 检索酒店 ---
    hotel_rows = await data_sources.fetch_hotels_by_embedding(pref_emb, destination, 20)

    hotels: List[Dict[str, Any]] = []
    for idx, row in enumerate(hotel_rows[:20], start=1):
        similarity = float(row.get("similarity") or 0.5)
        price_yuan = row.get("price_yuan") or row.get("cost") or row.get("priceYuan")
        hotels.append(
            {
                "id": idx,
                "name": _as_text(row.get("name"), f"{destination}推荐酒店{idx}"),
                "cost": int(float(price_yuan or 500)),
                "location": _as_text(row.get("location"), destination),
                "latitude": row.get("latitude"),
                "longitude": row.get("longitude"),
                "rating": _as_float(row.get("rating"), 4.0),
                "similarity": similarity,
                "match_score": similarity,
            }
        )

    if not hotels:
        logger.warning("向量检索酒店为空，使用默认酒店")
        default_hotel = choose_hotel(destination, int(req.get("budget", 10000)))
        hotels = [default_hotel]

    # 按 match_score 排序
    top_attractions = sorted(attractions, key=lambda x: x.get("match_score", 0), reverse=True)
    top_hotels = sorted(hotels, key=lambda x: x.get("match_score", 0), reverse=True)

    logger.info(
        "retrieval_agent 完成: attractions=%d, hotels=%d",
        len(top_attractions),
        len(top_hotels),
    )
    return {
        "candidate_attractions": attractions,
        "candidate_hotels": hotels,
        "top_attractions": top_attractions,
        "top_hotels": top_hotels,
    }


# ---------------------------------------------------------------------------
# Route Agent：坐标补全 + 最近邻路线排序
# ---------------------------------------------------------------------------

async def route_agent(state: AgentState) -> AgentState:
    """
    负责：
    1. 对没有坐标的景点/酒店补充地理编码（DB 优先，再 Amap，再伪坐标）
    2. 用最近邻算法对每天景点排序，降低总行驶距离
    3. 计算各酒店 + 景点组合的路线成本

    改进：跳过已有坐标的景点，避免冗余 API 调用。
    """
    req = state["request"]
    destination = req.get("destination", "")
    top_attractions: List[Dict[str, Any]] = state.get("top_attractions", [])
    top_hotels: List[Dict[str, Any]] = state.get("top_hotels", [])

    # --- 补全景点坐标（仅对缺失者调用 geocode）---
    geo_attractions: List[Dict[str, Any]] = []
    for a in top_attractions:
        lat = a.get("latitude")
        lng = a.get("longitude")
        if lat is None or lng is None:
            geo = await geocode_name(str(a.get("location") or a.get("name")), destination)
            lat, lng = geo["lat"], geo["lng"]
        geo_attractions.append({**a, "latitude": float(lat), "longitude": float(lng)})

    # --- 补全酒店坐标 ---
    geo_hotels: List[Dict[str, Any]] = []
    for h in top_hotels:
        lat = h.get("latitude")
        lng = h.get("longitude")
        if lat is None or lng is None:
            geo = await geocode_name(str(h.get("location") or h.get("name")), destination)
            lat, lng = geo["lat"], geo["lng"]
        geo_hotels.append({**h, "latitude": float(lat), "longitude": float(lng)})

    # --- 路线候选：每个候选酒店 × 最近邻排序后的景点 ---
    attraction_pool = geo_attractions[:12]  # 最多取 12 个参与路线规划
    route_candidates: List[Dict[str, Any]] = []
    for hotel in geo_hotels[:5]:
        # 对景点按最近邻排序（从酒店出发）
        sorted_attractions = nearest_neighbor_sort(hotel, attraction_pool)
        route = estimate_route_cost(hotel, sorted_attractions)
        route_candidates.append(
            {
                "hotel": hotel,
                "attractions": sorted_attractions,
                "route": route,
            }
        )

    day_skeleton = build_day_skeleton(req["startDate"], req["endDate"], destination)

    logger.info(
        "route_agent 完成: geo_attractions=%d, geo_hotels=%d, route_candidates=%d",
        len(geo_attractions),
        len(geo_hotels),
        len(route_candidates),
    )
    return {
        "geo_attractions": geo_attractions,
        "geo_hotels": geo_hotels,
        "route_candidates": route_candidates,
        "day_skeleton": day_skeleton,
    }


# ---------------------------------------------------------------------------
# Budget Agent：综合评分选最优酒店
# ---------------------------------------------------------------------------

async def budget_agent(state: AgentState) -> AgentState:
    """
    负责：
    1. 从路线候选中选出综合评分最高的酒店方案
    2. 评分维度：向量匹配度、酒店评分、路线时长惩罚、预算惩罚

    改进：加入了基于景点中心距离的酒店选择逻辑（对应 v2）。
    """
    req = state["request"]
    budget = int(req.get("budget", 10000))
    travelers = int(req.get("travelers", 2))
    route_candidates: List[Dict[str, Any]] = state.get("route_candidates", [])
    geo_attractions: List[Dict[str, Any]] = state.get("geo_attractions", [])

    best: Optional[Dict[str, Any]] = None
    best_score = -1e9

    for item in route_candidates:
        hotel = item["hotel"]
        route = item["route"]
        nightly = int(hotel.get("cost", 500))

        # 预算惩罚：单晚房费超出总预算 25% 则扣分
        budget_penalty = max(0.0, nightly * travelers - budget * 0.25) / 500.0

        score = (
            float(hotel.get("match_score", 0.5)) * 2.0      # 向量匹配度（权重最高）
            + float(hotel.get("rating", 4.0)) * 0.5          # 酒店评分
            - float(route.get("duration_min", 0)) / 200.0    # 路线时长惩罚
            - budget_penalty                                   # 超预算惩罚
        )

        if score > best_score:
            best_score = score
            best = item

    # 若路线候选为空，尝试直接从 geo_hotels 选一个接近景点中心的
    if best is None:
        geo_hotels: List[Dict[str, Any]] = state.get("geo_hotels", [])
        if geo_hotels and geo_attractions:
            selected_hotel = _select_hotel_near_attractions(geo_hotels, geo_attractions, budget)
        else:
            selected_hotel = choose_hotel(req.get("destination", ""), budget)
        best = {
            "hotel": selected_hotel,
            "attractions": geo_attractions[:8],
            "route": {"distance_km": 0, "duration_min": 0},
        }

    hotel = best["hotel"]
    logger.info("budget_agent 选定酒店: %s (score=%.3f)", hotel.get("name"), best_score)
    return {
        "selected_hotel": hotel,
        "best_plan": best,
        "cost_summary": {
            "budget": budget,
            "hotelNightly": hotel.get("cost", 500),
            "route": best.get("route", {}),
        },
    }


# ---------------------------------------------------------------------------
# Writer Agent：LLM 生成最终行程 JSON
# ---------------------------------------------------------------------------

async def writer_agent(state: AgentState) -> AgentState:
    """
    负责：
    1. 以 build_trip_response 构建结构化草稿（保证字段完整性）
    2. 将草稿 + 规划策略交给 LLM，生成更自然的行程描述
    3. 严格校验 LLM 输出，解析失败时直接使用草稿

    改进：LLM 提示词明确约束输出格式，减少幻觉；不再 passthrough 整个 JSON。
    """
    req = state["request"]
    best_plan: Dict[str, Any] = state.get("best_plan", {})
    day_skeleton: List[Dict[str, Any]] = state.get("day_skeleton", [])
    hotel: Dict[str, Any] = state.get("selected_hotel", {})
    plan_summary: str = state.get("plan", "")

    # 使用路线优化后的景点顺序
    attractions = best_plan.get(
        "attractions",
        state.get("top_attractions", state.get("candidate_attractions", [])),
    )

    # 构建草稿（保证结构完整，作为 fallback）
    draft = build_trip_response(req, attractions, hotel, day_skeleton)

    # --- LLM 润色行程描述 ---
    system_prompt = (
        "你是 ItineraryWriter Agent。"
        "请基于提供的行程草稿，优化每个活动的 title 和 description，使其更加生动具体、符合旅行风格。"
        "严格保持 JSON 结构不变，不要增减字段，不要添加任何解释文字。"
        "只输出合法的 JSON 对象。"
    )
    # 只传递需要润色的核心部分，减少 token 消耗
    llm_input = {
        "destination": draft["destination"],
        "travelStyle": draft["travelStyle"],
        "planSummary": plan_summary,
        "days": draft["days"],
        "highlights": draft["highlights"],
    }
    user_prompt = json.dumps(llm_input, ensure_ascii=False)

    final_trip: Dict[str, Any] = draft
    try:
        content = await model_router.chat_with_fallback(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        )
        normalized = content.replace("```json", "").replace("```", "").strip()
        llm_result = json.loads(normalized)

        # 只取 LLM 优化的字段，其余保持草稿
        if isinstance(llm_result, dict):
            if isinstance(llm_result.get("days"), list) and llm_result["days"]:
                draft["days"] = llm_result["days"]
            if isinstance(llm_result.get("highlights"), list) and llm_result["highlights"]:
                draft["highlights"] = llm_result["highlights"]
        final_trip = draft
    except Exception as exc:
        logger.warning("writer_agent LLM 润色失败，使用草稿: %s", exc)
        final_trip = draft

    # 最终兜底：保证 description 为字符串，避免 response_model 校验失败
    for day in final_trip.get("days", []):
        for act in day.get("activities", []):
            if isinstance(act.get("description"), list):
                act["description"] = "，".join(str(x) for x in act["description"])
            elif not isinstance(act.get("description"), str):
                act["description"] = str(act.get("description", ""))

    logger.info("writer_agent 完成: days=%d", len(final_trip.get("days", [])))
    return {"final_trip": final_trip}
