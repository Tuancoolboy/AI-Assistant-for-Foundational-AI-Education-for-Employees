from __future__ import annotations

from backend.agents.state import AgentState
from backend.services.learning_data import load_learning_data


async def retrieve_context_node(state: AgentState) -> dict:
    """Tìm kiếm các module học tập/kiến thức liên quan đến query."""
    query = state.get("query", "").lower()
    retrieved = []
    
    try:
        data = load_learning_data()
        # Tìm kiếm đơn giản (Keyword-based) trong module titles và descriptions
        for module in data.get("modules", []):
            title = module.get("title", "").lower()
            desc = module.get("description", "").lower()
            if any(word in title or word in desc for word in query.split()):
                retrieved.append(
                    f"Bài học: {module.get('title')} (Mức độ: {module.get('level')})\n"
                    f"Mô tả: {module.get('description')}\n"
                    f"Kỹ năng: {', '.join(module.get('goal_tags', []))}"
                )
            if len(retrieved) >= 3: # Lấy tối đa 3 context liên quan nhất
                break
    except Exception as e:
        # Nếu lỗi (ví dụ không có file học tập), bỏ qua và trả về rỗng
        pass
        
    return {"retrieved_contexts": retrieved}
