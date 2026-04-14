from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class AgentState(TypedDict, total=False):
    request: Dict[str, Any]
    plan: str
    candidate_attractions: List[Dict[str, Any]]
    selected_hotel: Dict[str, Any]
    day_skeleton: List[Dict[str, Any]]
    cost_summary: Dict[str, Any]
    final_trip: Dict[str, Any]
