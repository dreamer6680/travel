from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class AgentState(TypedDict, total=False):
    # 原始请求
    request: Dict[str, Any]

    # Planner Agent 输出
    plan: str
    structured_requirements: Dict[str, Any]  # 新增：LLM 提取的结构化需求
    preference_text: str
    preference_embedding: List[float]

    # Retrieval Agent 输出
    candidate_attractions: List[Dict[str, Any]]
    candidate_hotels: List[Dict[str, Any]]
    top_attractions: List[Dict[str, Any]]   # 按 match_score 排序
    top_hotels: List[Dict[str, Any]]        # 按 match_score 排序

    # Route Agent 输出
    geo_attractions: List[Dict[str, Any]]   # 已补全坐标，最近邻排序
    geo_hotels: List[Dict[str, Any]]        # 已补全坐标
    route_candidates: List[Dict[str, Any]]  # 各酒店路线方案
    day_skeleton: List[Dict[str, Any]]

    # Budget Agent 输出
    selected_hotel: Dict[str, Any]
    best_plan: Dict[str, Any]
    cost_summary: Dict[str, Any]

    # Writer Agent 输出
    final_trip: Dict[str, Any]
