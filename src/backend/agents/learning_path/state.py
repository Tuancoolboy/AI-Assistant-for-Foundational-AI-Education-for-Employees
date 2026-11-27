from __future__ import annotations

from typing import Any, TypedDict


class GraphTrajectoryEdge(TypedDict, total=False):
    id: str
    module_id: str
    concept_id: str | None
    edge_type: str
    valid_from: str
    valid_to: str | None
    system_recorded_at: str

class GraphReasoningTrace(TypedDict, total=False):
    timestamp: str
    trace: str

class LearningPathState(TypedDict, total=False):
    """LangGraph state cho agent sinh lộ trình học.

    State chỉ chứa dữ liệu cần truyền giữa các node. Các node chỉ return phần
    field thay đổi, và mọi field đều là optional để hỗ trợ degrade từng phần.
    """

    user_id: str
    mode: str
    role_id: str
    ai_level: int
    force_refresh: bool
    hints: dict[str, Any]
    gateway: Any
    daily_tasks: list[str]
    trajectory_edges: list[GraphTrajectoryEdge]
    reasoning_traces: list[GraphReasoningTrace]
    organization_id: str | None
    organization_name: str | None
    position_skill_slugs: list[str]
    assessment_gap_module_ids: list[str]
    manager_priority_module_ids: list[str]
    assigned_path_module_ids: list[str]
    assigned_path_title: str | None
    flow: str
    candidate_pool: list[dict[str, Any]]
    fingerprint: str
    cached_path: dict[str, Any] | None
    llm_raw: dict[str, Any] | None
    path: dict[str, Any]
    source: str
    cached: bool
    error: str
    degraded: list[str]
