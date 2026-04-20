from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from ..config import settings
from ..model_router import model_router
from ..services.data_sources import data_sources
from ..services.embedding_service import build_preference_text, embed_text
from ..services.location_tools import geocode_poi
from ..services.pg_vector_store import pg_vector_store
from ..services.routing_service import estimate_route_cost, nearest_neighbor_sort
from ..services.trip_tools import (
    build_candidate_attractions,
    build_candidate_restaurants,
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

    # 计算人均每日可支配预算，辅助 LLM 做档次判断
    from datetime import datetime as _dt
    try:
        _days = max((_dt.fromisoformat(end_date) - _dt.fromisoformat(start_date)).days + 1, 1)
    except Exception:
        _days = 3
    daily_budget = int(budget / max(_days, 1))

    # --- LLM 结构化需求提取 ---
    system_prompt = (
        "你是旅行 Planner Agent。请根据用户输入，以 JSON 格式输出规划策略，"
        "字段：mustVisit(必去景点列表)、preferredTypes(偏好景点类型列表)、"
        "highlights(行程亮点列表，3-5条)、planSummary(一段简短规划思路描述)。\n"
        "【预算约束 - 必须遵守】\n"
        f"- 人均总预算 {budget} 元，行程天数 {_days} 天，人均每日约 {daily_budget} 元\n"
        "- 预算涵盖酒店+交通+餐饮+门票，请在 planSummary 中说明如何分配\n"
        "- 推荐的景点、餐厅档次必须与预算相符，严禁推荐明显超出预算的高消费场所\n"
        "- 经济型预算(<5000元)：推荐实惠餐厅、平价景点；中端(5000-15000)：正餐+热门景点；高端(>15000)：精品体验\n"
        "只输出 JSON，不要附加任何解释。"
    )
    user_prompt = (
        f"目的地: {destination}\n"
        f"出行风格: {travel_style}\n"
        f"兴趣偏好: {interests}\n"
        f"总预算: {budget} 元（人均，含全部支出）\n"
        f"出行人数: {travelers} 人\n"
        f"日期: {start_date} 至 {end_date}（共 {_days} 天）"
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
                "hotel_id": row.get("hotel_id"),
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

    # --- 检索餐厅 ---
    restaurant_rows = await data_sources.fetch_restaurants_by_embedding(
        pref_emb, destination, interests, 20
    )

    restaurants: List[Dict[str, Any]] = []
    for idx, row in enumerate(restaurant_rows[:20], start=1):
        similarity = float(row.get("similarity") or 0.5)
        rating = _as_float(row.get("rating"), 4.0)
        match_score = min(similarity + (rating - 3.5) / 20.0, 1.0)
        restaurants.append(
            {
                "id": idx,
                "restaurant_id": row.get("restaurant_id"),
                "name": _as_text(row.get("name"), f"{destination}推荐餐厅{idx}"),
                "type": _as_text(row.get("type"), "餐厅"),
                "description": _as_text(row.get("description"), "当地特色风味"),
                "location": _as_text(row.get("location"), destination),
                "rating": rating,
                "price_yuan": row.get("price_yuan"),
                "price_range": row.get("price_range"),
                "latitude": row.get("latitude"),
                "longitude": row.get("longitude"),
                "similarity": similarity,
                "match_score": match_score,
            }
        )

    if not restaurants:
        logger.warning("向量检索餐厅为空，使用候选兜底")
        restaurants = build_candidate_restaurants(destination)

    # 按 match_score 排序
    top_attractions = sorted(attractions, key=lambda x: x.get("match_score", 0), reverse=True)
    top_hotels = sorted(hotels, key=lambda x: x.get("match_score", 0), reverse=True)
    top_restaurants = sorted(restaurants, key=lambda x: x.get("match_score", 0), reverse=True)

    logger.info(
        "retrieval_agent 完成: attractions=%d, hotels=%d, restaurants=%d",
        len(top_attractions),
        len(top_hotels),
        len(top_restaurants),
    )
    return {
        "candidate_attractions": attractions,
        "candidate_hotels": hotels,
        "candidate_restaurants": restaurants,
        "top_attractions": top_attractions,
        "top_hotels": top_hotels,
        "top_restaurants": top_restaurants,
    }


# ---------------------------------------------------------------------------
# Route Agent：坐标补全 + 最近邻路线排序
# ---------------------------------------------------------------------------

async def route_agent(state: AgentState) -> AgentState:
    """
    负责：
    1. 对没有坐标的景点/酒店/餐厅补充地理编码（DB 优先，再 Amap，再伪坐标）
    2. 用最近邻算法对每天景点排序，降低总行驶距离
    3. 计算各酒店 + 景点组合的路线成本
    """
    req = state["request"]
    destination = req.get("destination", "")
    top_attractions: List[Dict[str, Any]] = state.get("top_attractions", [])
    top_hotels: List[Dict[str, Any]] = state.get("top_hotels", [])
    top_restaurants: List[Dict[str, Any]] = state.get("top_restaurants", [])

    refresh = bool(settings.amap_web_service_key and settings.amap_refresh_existing_coords)

    async def _enrich(items: List[Dict[str, Any]], entity: str) -> List[Dict[str, Any]]:
        result = []
        for item in items:
            lat = item.get("latitude")
            lng = item.get("longitude")
            if lat is None or lng is None or refresh:
                geo = await geocode_poi(
                    str(item.get("name") or ""),
                    str(item.get("location") or ""),
                    destination,
                    entity=entity,
                )
                lat, lng = geo["lat"], geo["lng"]
            result.append({**item, "latitude": float(lat), "longitude": float(lng)})
        return result

    geo_attractions = await _enrich(top_attractions, "attraction")
    geo_hotels = await _enrich(top_hotels, "hotel")
    geo_restaurants = await _enrich(top_restaurants, "restaurant")

    # --- 路线候选：每个候选酒店 × 最近邻排序后的景点 ---
    attraction_pool = geo_attractions[:12]
    route_candidates: List[Dict[str, Any]] = []
    for hotel in geo_hotels[:5]:
        sorted_attractions = nearest_neighbor_sort(hotel, attraction_pool)
        route = estimate_route_cost(hotel, sorted_attractions)
        route_candidates.append(
            {
                "hotel": hotel,
                "attractions": sorted_attractions,
                "restaurants": geo_restaurants,  # 餐厅按邻近度在 trip_tools 中匹配
                "route": route,
            }
        )

    day_skeleton = build_day_skeleton(req["startDate"], req["endDate"], destination)

    logger.info(
        "route_agent 完成: geo_attractions=%d, geo_hotels=%d, geo_restaurants=%d, route_candidates=%d",
        len(geo_attractions),
        len(geo_hotels),
        len(geo_restaurants),
        len(route_candidates),
    )
    return {
        "geo_attractions": geo_attractions,
        "geo_hotels": geo_hotels,
        "geo_restaurants": geo_restaurants,
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

    # --- 硬性预算过滤：仅保留单晚费用在合理范围内的方案 ---
    total_days = len(state.get("day_skeleton", []))
    # 酒店最多消耗总预算的 40%（留余地给交通/餐饮）
    max_hotel_total = budget * 0.40
    max_hotel_nightly = max(150, int(max_hotel_total / max(total_days, 1)))

    affordable = [
        c for c in route_candidates
        if int(c["hotel"].get("cost", 500)) <= max_hotel_nightly
    ]
    if affordable:
        route_candidates = affordable
        logger.info(
            "budget_agent: 预算过滤后剩余 %d 个路线方案 (最高单价 ¥%d/晚)",
            len(route_candidates), max_hotel_nightly,
        )
    else:
        logger.warning(
            "budget_agent: 所有方案均超出每晚上限 ¥%d，保留全部方案并加重惩罚",
            max_hotel_nightly,
        )

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

    # 使用路线优化后的景点顺序；餐厅使用 geo_restaurants（已补全坐标）
    attractions = best_plan.get(
        "attractions",
        state.get("top_attractions", state.get("candidate_attractions", [])),
    )
    restaurants = best_plan.get(
        "restaurants",
        state.get("geo_restaurants", state.get("top_restaurants", state.get("candidate_restaurants", []))),
    )

    # 构建草稿（保证结构完整，作为 fallback）
    draft = build_trip_response(
        req,
        attractions,
        restaurants,
        hotel,
        day_skeleton,
        all_attractions=state.get("candidate_attractions", []),
        all_hotels=state.get("candidate_hotels", []),
        all_restaurants=state.get("candidate_restaurants", []),
    )

    _PRESERVED_ACTIVITY_FIELDS = ("ref", "priceYuan", "coordinate")

    def _backup_activity_extras(days_src: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        return [
            [
                {k: a[k] for k in _PRESERVED_ACTIVITY_FIELDS if k in a}
                for a in (d.get("activities") or [])
            ]
            for d in (days_src or [])
        ]

    def _merge_activity_refs(
        days_dest: List[Dict[str, Any]], backups: List[List[Dict[str, Any]]]
    ) -> None:
        for di, day in enumerate(days_dest or []):
            if di >= len(backups):
                break
            acts = day.get("activities") or []
            for ai, act in enumerate(acts):
                if ai < len(backups[di]):
                    for k, v in backups[di][ai].items():
                        if k not in act or act[k] is None:
                            act[k] = v

    activity_ref_backup = _backup_activity_extras(draft.get("days", []))

    def _strip_redundant_text_if_ref(days_src: List[Dict[str, Any]]) -> None:
        """Mongo 侧 ref 活动只存 time/type/ref（及 priceYuan），不落 title/description/location。"""
        for day in days_src or []:
            for act in day.get("activities") or []:
                ref = act.get("ref")
                if not isinstance(ref, dict):
                    continue
                if ref.get("attractionId") or ref.get("hotelId") or ref.get("restaurantId"):
                    act.pop("title", None)
                    act.pop("description", None)
                    act.pop("location", None)

    # 用于 Writer 提示词的预算档次说明
    budget_tier = (
        "经济型（实惠餐厅、公共交通、平价景点）" if int(req.get("budget", 10000)) < 5000
        else "中端（正餐、偶尔打车、热门景点）" if int(req.get("budget", 10000)) < 15000
        else "高端（精品餐厅、舒适交通、优质体验）"
    )

    # --- LLM 润色行程描述 ---
    system_prompt = (
        "你是 ItineraryWriter Agent。\n"
        f"【严格预算约束】人均总预算 {req.get('budget', 10000)} 元，消费档次：{budget_tier}。\n"
        "- 活动描述中提及的餐厅、场所必须与该消费档次相符\n"
        "- 不要在描述中出现与预算不符的高档场所（如米其林餐厅）或过于低端的选择\n"
        "- 餐厅描述应包含大致人均消费参考\n"
        "请基于提供的行程草稿，优化「无 ref」活动的 title 和 description，使其更加生动具体、符合旅行风格。\n"
        "【重要】若某 activity 含 ref 且含 attractionId / hotelId / restaurantId："
        "不要输出 title、description、location 字段，只保留 time、type、ref（及已有 priceYuan）。\n"
        "每个 activity 的 ref 对象必须原样保留，不得删除或修改 id。\n"
        "严格保持 JSON 结构，不要添加解释文字。只输出合法的 JSON 对象。"
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
        logger.info(
            "writer_agent: 开始 LLM 润色 days=%d user_json_chars=%d read_timeout=%.0fs ollama_base=%s model=%s",
            len(draft.get("days") or []),
            len(user_prompt),
            settings.writer_llm_timeout_seconds,
            settings.ollama_base_url,
            settings.ollama_chat_model,
        )
        content = await model_router.chat_with_fallback(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            read_timeout=settings.writer_llm_timeout_seconds,
        )
        logger.info("writer_agent: LLM 返回 content_chars=%d", len(content))
        normalized = content.replace("```json", "").replace("```", "").strip()
        llm_result = json.loads(normalized)

        # 只取 LLM 优化的字段，其余保持草稿
        if isinstance(llm_result, dict):
            if isinstance(llm_result.get("days"), list) and llm_result["days"]:
                draft["days"] = llm_result["days"]
                _merge_activity_refs(draft["days"], activity_ref_backup)
            if isinstance(llm_result.get("highlights"), list) and llm_result["highlights"]:
                draft["highlights"] = llm_result["highlights"]
        final_trip = draft
    except Exception as exc:
        logger.warning("writer_agent LLM 润色失败，使用草稿: %r", exc)
        final_trip = draft

    _strip_redundant_text_if_ref(final_trip.get("days", []))

    # 兜底：无 ref 的活动若 description 异常，规范为字符串（有 ref 的可省略 description）
    for day in final_trip.get("days", []):
        for act in day.get("activities", []):
            desc = act.get("description")
            if isinstance(desc, list):
                act["description"] = "，".join(str(x) for x in desc)
            elif desc is not None and not isinstance(desc, str):
                act["description"] = str(desc)

    logger.info("writer_agent 完成: days=%d", len(final_trip.get("days", [])))
    return {"final_trip": final_trip}


# ---------------------------------------------------------------------------
# Budget Validator：校验并修正最终行程总花费
# ---------------------------------------------------------------------------

async def budget_validator(state: AgentState) -> AgentState:
    """
    在 Writer 生成行程后做最终预算校验（Reaction 机制）：
    1. 计算 酒店总价 + 交通 + 餐饮 的预估总支出
    2. 若超出用户预算，自动下调酒店单价，并更新 practicalInfo
    3. 输出 budget_validated 摘要供日志追踪
    """
    req = state["request"]
    budget = int(req.get("budget", 10000))
    final_trip = state.get("final_trip", {})
    total_days = len(final_trip.get("days", []))

    hotel = final_trip.get("selectedHotel") or {}
    hotel_nightly = int(hotel.get("cost", 500))
    hotel_total = hotel_nightly * total_days

    transport = max(int(budget * 0.15), 200)
    food = max(int(budget * 0.25), 300)
    estimated_total = hotel_total + transport + food

    status = "ok"
    adjustment = None

    if estimated_total > budget and total_days > 0:
        remaining_for_hotel = max(0, budget - transport - food)
        new_nightly = max(150, remaining_for_hotel // total_days)

        # 更新 selectedHotel
        if final_trip.get("selectedHotel"):
            final_trip["selectedHotel"]["cost"] = new_nightly

        # 同步更新 practicalInfo.accommodation
        prac = final_trip.get("practicalInfo", {})
        for acc in prac.get("accommodation", []):
            acc["cost"] = new_nightly
            acc.pop("totalCost", None)
            acc["totalCost"] = new_nightly * total_days
            acc["nights"] = total_days

        adjustment = {
            "old_nightly": hotel_nightly,
            "new_nightly": new_nightly,
            "reason": f"酒店总价 ¥{hotel_total} + 交通 ¥{transport} + 餐饮 ¥{food} = ¥{estimated_total} > 预算 ¥{budget}",
        }
        status = "adjusted"
        logger.warning(
            "budget_validator: 超支调整 酒店 ¥%d→¥%d/晚 | 原估算 ¥%d > 预算 ¥%d",
            hotel_nightly, new_nightly, estimated_total, budget,
        )
    else:
        logger.info(
            "budget_validator: 预算校验通过 (估算 ¥%d / 预算 ¥%d)",
            estimated_total, budget,
        )

    return {
        "final_trip": final_trip,
        "budget_validated": {
            "status": status,
            "budget": budget,
            "estimated_total": estimated_total,
            "adjustment": adjustment,
        },
    }
