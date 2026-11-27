from __future__ import annotations

from langgraph.graph import END, StateGraph

from backend.agents.nodes.retrieve_node import retrieve_context_node
from backend.agents.nodes.augment_node import augment_prompt_node
from backend.agents.nodes.llm_node import llm_respond_node
from backend.agents.nodes.post_process_node import post_process_node
from backend.agents.state import AgentState


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    # Thêm các node vào Graph
    graph.add_node("retrieve", retrieve_context_node)
    graph.add_node("augment", augment_prompt_node)
    graph.add_node("llm", llm_respond_node)
    graph.add_node("post_process", post_process_node)

    # Thiết lập luồng chạy (Edges)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "augment")
    graph.add_edge("augment", "llm")
    graph.add_edge("llm", "post_process")
    graph.add_edge("post_process", END)

    return graph.compile()


agent = build_graph()
