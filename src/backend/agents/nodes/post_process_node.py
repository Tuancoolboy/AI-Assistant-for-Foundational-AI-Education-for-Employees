from __future__ import annotations

from backend.agents.state import AgentState
from backend.services.openai_helpers import strip_leading_assistant_greeting


async def post_process_node(state: AgentState) -> dict:
    """Xử lý hậu kỳ câu trả lời của AI trợ lý."""
    response = state.get("response", "")
    
    # Chuẩn hóa khoảng trắng và loại bỏ lời chào đầu thừa nếu có
    cleaned_response = strip_leading_assistant_greeting(response.strip())
    
    # Có thể bổ sung thêm metadata hoặc logs ở đây trong tương lai
    
    return {"response": cleaned_response}
