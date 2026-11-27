from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Tin nhắn từ user")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Phản hồi từ agent")
    analysis: str = Field(default="", description="Phân tích nội bộ")


class BackendStatusResponse(BaseModel):
    status: str = Field(..., description="Trạng thái backend")
    env: str = Field(..., description="Môi trường chạy (development/production/test)")

from typing import List, Optional
from datetime import datetime
from enum import Enum

class EdgeType(str, Enum):
    COMPLETED = "COMPLETED"
    STRUGGLED = "STRUGGLED"
    MISAPPLIED = "MISAPPLIED"

class TrajectoryEdge(BaseModel):
    id: str
    module_id: str
    edge_type: EdgeType
    valid_from: datetime
    system_recorded_at: datetime

class ReasoningTrace(BaseModel):
    timestamp: datetime
    trace: str

class BitemporalData(BaseModel):
    edges: List[TrajectoryEdge]
    reasoning: List[ReasoningTrace]
