from __future__ import annotations

from langgraph.graph import END, StateGraph

from .nodes import budget_agent, budget_validator, planner_agent, retrieval_agent, route_agent, writer_agent
from .state import AgentState


def build_trip_agent_graph():
    graph = StateGraph(AgentState)

    graph.add_node("planner", planner_agent)
    graph.add_node("retrieval", retrieval_agent)
    graph.add_node("route", route_agent)
    graph.add_node("budget", budget_agent)
    graph.add_node("writer", writer_agent)
    graph.add_node("budget_validator", budget_validator)

    graph.set_entry_point("planner")
    graph.add_edge("planner", "retrieval")
    graph.add_edge("retrieval", "route")
    graph.add_edge("route", "budget")
    graph.add_edge("budget", "writer")
    graph.add_edge("writer", "budget_validator")   # 生成后校验预算
    graph.add_edge("budget_validator", END)

    return graph.compile()


trip_agent_graph = build_trip_agent_graph()
