from __future__ import annotations

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class ChatEvalSample(BaseModel):
    """Mẫu đánh giá cho Chat Agent."""
    question: str = Field(..., description="Câu hỏi/tin nhắn của user")
    answer: str = Field(..., description="Câu trả lời của AI trợ lý")
    contexts: List[str] = Field(default_factory=list, description="Các đoạn context được dùng để sinh câu trả lời (RAG)")
    ground_truth: Optional[str] = Field(None, description="Câu trả lời mẫu chuẩn (nếu có)")


class LearningPathEvalSample(BaseModel):
    """Mẫu đánh giá cho Learning Path Agent."""
    role_id: str = Field(..., description="Vai trò của nhân viên")
    ai_level: int = Field(..., description="Mức AI hiện tại của nhân viên")
    completed_module_ids: List[str] = Field(default_factory=list, description="Danh sách các module đã hoàn thành")
    expected_module_ids: List[str] = Field(default_factory=list, description="Danh sách module mong đợi (heuristic/benchmark)")
    generated_path: Optional[Dict[str, Any]] = Field(None, description="Lộ trình thực tế được sinh ra")


class GradingEvalSample(BaseModel):
    """Mẫu đánh giá cho Grading Agent (Agent 2)."""
    prompt: str = Field(..., description="Câu hỏi tự luận/yêu cầu bài học")
    answer: str = Field(..., description="Bài làm tự luận của nhân viên")
    score: Optional[int] = Field(None, description="Điểm số do AI chấm (0-100)")
    feedback: Optional[str] = Field(None, description="Nhận xét của AI")
    human_score: Optional[int] = Field(None, description="Điểm số do quản lý chấm thực tế (nếu có)")
