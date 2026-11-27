from __future__ import annotations

from langgraph.graph import END, StateGraph

from .nodes import (
    build_pool_node,
    check_cache_node,
    fallback_node,
    finalize_cache_node,
    llm_select_node,
    load_context_node,
    persist_node,
    route_after_cache,
    route_after_validate,
    validate_node,
)
from .state import LearningPathState


def build_learning_path_graph():
    graph = StateGraph(LearningPathState)
    graph.add_node("load_context", load_context_node)
    graph.add_node("check_cache", check_cache_node)
    graph.add_node("finalize_cache", finalize_cache_node)
    graph.add_node("build_pool", build_pool_node)
    graph.add_node("llm_select", llm_select_node)
    graph.add_node("validate", validate_node)
    graph.add_node("fallback", fallback_node)
    graph.add_node("persist", persist_node)

    graph.set_entry_point("load_context")
    graph.add_edge("load_context", "check_cache")
    graph.add_conditional_edges("check_cache", route_after_cache)
    graph.add_edge("build_pool", "llm_select")
    graph.add_edge("llm_select", "validate")
    graph.add_conditional_edges("validate", route_after_validate)
    graph.add_edge("fallback", "persist")
    graph.add_edge("persist", END)
    graph.add_edge("finalize_cache", END)
    return graph.compile()


learning_path_agent = build_learning_path_graph()
