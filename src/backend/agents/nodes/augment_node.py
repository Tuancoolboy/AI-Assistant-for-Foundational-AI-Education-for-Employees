from __future__ import annotations

from backend.agents.state import AgentState


async def augment_prompt_node(state: AgentState) -> dict:
    """Xây dựng prompt kết hợp ngữ cảnh (RAG) và lịch sử hội thoại."""
    query = state.get("query", "")
    contexts = state.get("retrieved_contexts", [])
    memory = state.get("memory_context", "")

    # Lắp ráp prompt
    augmented = ""
    if contexts:
        augmented += "Dưới đây là một số tài liệu học tập/ngữ cảnh hỗ trợ liên quan:\n"
        augmented += "\n---\n".join(contexts) + "\n\n"
        
    if memory:
        augmented += f"Thông tin ghi nhớ từ cuộc trò chuyện trước:\n{memory}\n\n"
        
    augmented += f"Câu hỏi của người học: {query}\n"
    
    return {"augmented_prompt": augmented}
