from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class AgentState(TypedDict, total=False):
    request: Dict[str, Any]
    plan: str
    preference_text: str
    preference_embedding: List[float]
    candidate_attractions: List[Dict[str, Any]]
    candidate_hotels: List[Dict[str, Any]]
    top_attractions: List[Dict[str, Any]]
    top_hotels: List[Dict[str, Any]]
    geo_attractions: List[Dict[str, Any]]
    geo_hotels: List[Dict[str, Any]]
    route_candidates: List[Dict[str, Any]]
    best_plan: Dict[str, Any]
    selected_hotel: Dict[str, Any]
    day_skeleton: List[Dict[str, Any]]
    cost_summary: Dict[str, Any]
    final_trip: Dict[str, Any]
