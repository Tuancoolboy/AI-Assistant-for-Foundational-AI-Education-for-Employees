from __future__ import annotations

from backend.agents.state import AgentState
from backend.services.openai_helpers import get_openai_client, get_openai_model, get_fallback_answer, strip_leading_assistant_greeting


async def llm_respond_node(state: AgentState) -> dict:
    """Gọi OpenAI hoặc mock để trả lời dựa trên prompt mở rộng."""
    augmented = state.get("augmented_prompt", "")
    system_prompt = state.get("system_prompt", "Bạn là Trợ lý AI.")
    query = state.get("query", "")
    
    client = get_openai_client()
    if not client:
        # Fallback nếu chưa config OpenAI
        fb = get_fallback_answer(query, "khac")
        response = strip_leading_assistant_greeting(str(fb["answer"]))
        return {"response": response}

    try:
        response = await client.chat.completions.create(
            model=get_openai_model(),
            max_tokens=600,
            temperature=0.7,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": augmented},
            ],
        )
        raw_text = response.choices[0].message.content or ""
        answer = strip_leading_assistant_greeting(raw_text)
        return {"response": answer}
    except Exception as e:
        return {"error": str(e), "response": "Xin lỗi, đã xảy ra sự cố kết nối với mô hình AI."}
