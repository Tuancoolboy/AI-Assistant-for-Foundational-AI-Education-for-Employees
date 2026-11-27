from __future__ import annotations

from typing import TypedDict, List, Optional, Any


class AgentState(TypedDict, total=False):
    """State schema cho LangGraph Chat Agent.

    Mỗi node đọc và ghi vào state này.
    total=False cho phép tất cả fields là optional.
    """

    query: str
    user_id: str
    session_id: str
    system_prompt: str
    retrieved_contexts: List[str]      # Các context tìm kiếm được từ RAG
    augmented_prompt: str
    response: str
    error: str
    metadata: dict
    memory_context: str                # Lịch sử hội thoại tóm tắt / memory
