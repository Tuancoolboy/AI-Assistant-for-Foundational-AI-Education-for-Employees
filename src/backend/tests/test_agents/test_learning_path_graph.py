from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from backend.agents.learning_path.graph import learning_path_agent


class FakeGateway:
    def __init__(self, *, select_map: dict[str, object] | None = None) -> None:
        self.select_map = select_map or {}
        self.upserts: list[tuple[str, dict[str, object], str]] = []

    async def select(self, table: str, *, query, **kwargs):
        value = self.select_map.get(table, [])
        if isinstance(value, Exception):
            raise value
        return value

    async def upsert(self, table: str, payload, *, on_conflict: str):
        self.upserts.append((table, payload, on_conflict))
        return []


def _modules() -> list[dict[str, object]]:
    return [
        {
            "id": "marketing-m1",
            "title": "Nền tảng AI cho marketing",
            "level": 1,
            "sort_order": 1,
            "skills": ["nen-tang-ai"],
            "isFoundation": True,
        },
        {
            "id": "marketing-m2",
            "title": "Viết prompt hiệu quả",
            "level": 2,
            "sort_order": 2,
            "skills": ["viet-prompt"],
            "isFoundation": True,
        },
        {
            "id": "marketing-m3",
            "title": "An toàn dữ liệu",
            "level": 3,
            "sort_order": 3,
            "skills": ["an-toan-du-lieu"],
            "isFoundation": False,
        },
    ]


@pytest.mark.asyncio
async def test_learning_path_graph_falls_back_without_openai():
    gateway = FakeGateway()
    with patch("backend.agents.learning_path.ranking.get_modules_for_role", return_value=_modules()), patch(
        "backend.agents.learning_path.nodes.is_openai_configured",
        return_value=False,
    ):
        result = await learning_path_agent.ainvoke(
            {
                "mode": "demo",
                "user_id": "u1",
                "role_id": "marketing",
                "ai_level": 1,
                "trajectory_edges": [],
                "gateway": gateway,
            }
        )

    assert result["path"]["source"] == "fallback"
    assert result["path"]["groups"]
    assert result["path"]["fingerprint"]


@pytest.mark.asyncio
async def test_learning_path_graph_uses_valid_llm_output_and_skips_completed():
    gateway = FakeGateway()
    llm_raw = {
        "summary": "Lộ trình ưu tiên nền tảng",
        "reasoningTrace": "Học sinh đã hoàn thành marketing-m1, nên tiếp tục học marketing-m2.",
        "groups": [
            {
                "title": "Nền tảng",
                "reason": "Học trước phần cơ bản",
                "moduleIds": ["marketing-m1", "marketing-m2", "bịa-id"],
            }
        ],
        "missingSkills": ["nen-tang-ai"],
    }
    with patch("backend.agents.learning_path.ranking.get_modules_for_role", return_value=_modules()), patch(
        "backend.agents.learning_path.nodes.is_openai_configured",
        return_value=True,
    ), patch(
        "backend.agents.learning_path.nodes.chat_completion_json",
        new=AsyncMock(return_value=llm_raw),
    ):
        result = await learning_path_agent.ainvoke(
            {
                "mode": "demo",
                "user_id": "u1",
                "role_id": "marketing",
                "ai_level": 1,
                "trajectory_edges": [{"module_id": "marketing-m1", "edge_type": "COMPLETED"}],
                "gateway": gateway,
            }
        )

    assert result["path"]["source"] == "agent"
    assert result["path"]["fingerprint"]
    assert all(
        module_id in {"marketing-m2", "marketing-m3"}
        for module_id in result["path"]["groups"][0]["moduleIds"]
    )
    assert len(result["reasoning_traces"]) == 1
    assert result["reasoning_traces"][0]["trace"] == "Học sinh đã hoàn thành marketing-m1, nên tiếp tục học marketing-m2."


@pytest.mark.asyncio
async def test_learning_path_graph_rejects_bogus_llm_output_and_falls_back():
    gateway = FakeGateway()
    with patch("backend.agents.learning_path.ranking.get_modules_for_role", return_value=_modules()), patch(
        "backend.agents.learning_path.nodes.is_openai_configured",
        return_value=True,
    ), patch(
        "backend.agents.learning_path.nodes.chat_completion_json",
        new=AsyncMock(return_value={"groups": [{"title": "X", "reason": "Y", "moduleIds": ["bịa-id"]}]}),
    ):
        result = await learning_path_agent.ainvoke(
            {
                "mode": "demo",
                "user_id": "u1",
                "role_id": "marketing",
                "ai_level": 1,
                "trajectory_edges": [],
                "gateway": gateway,
            }
        )

    assert result["path"]["source"] == "fallback"
    assert result["path"]["groups"]
    assert result["path"]["fingerprint"]


@pytest.mark.asyncio
async def test_learning_path_graph_degrades_when_one_source_fails():
    gateway = FakeGateway(
        select_map={
            "profiles": [{"role_id": "marketing", "ai_level": 1}],
            "temporal_knowledge_edges": RuntimeError("boom"),
            "organization_members": [],
        }
    )
    with patch("backend.agents.learning_path.ranking.get_modules_for_role", return_value=_modules()), patch(
        "backend.agents.learning_path.nodes.is_openai_configured",
        return_value=False,
    ):
        result = await learning_path_agent.ainvoke(
            {
                "mode": "supabase",
                "user_id": "u1",
                "gateway": gateway,
                "force_refresh": True,
            }
        )

    assert "temporal_knowledge_edges" in result["degraded"]
    assert result["path"]["source"] == "fallback"
    assert result["path"]["groups"]


@pytest.mark.asyncio
async def test_learning_path_graph_handles_retroactive_correction():
    gateway = FakeGateway()
    llm_raw = {
        "summary": "Lộ trình sửa đổi",
        "reasoningTrace": "Dữ liệu quá khứ cho thấy điểm module 1 đã bị hạ xuống STRUGGLED, cần học lại nền tảng.",
        "groups": [
            {
                "title": "Học lại nền tảng",
                "reason": "Phát hiện lỗ hổng kiến thức",
                "moduleIds": ["marketing-m1", "marketing-m2"],
            }
        ],
        "missingSkills": [],
    }
    with patch("backend.agents.learning_path.ranking.get_modules_for_role", return_value=_modules()), patch(
        "backend.agents.learning_path.nodes.is_openai_configured",
        return_value=True,
    ), patch(
        "backend.agents.learning_path.nodes.chat_completion_json",
        new=AsyncMock(return_value=llm_raw),
    ):
        result = await learning_path_agent.ainvoke(
            {
                "mode": "demo",
                "user_id": "u1",
                "role_id": "marketing",
                "ai_level": 1,
                # Giả lập retroactive correction: một event COMPLETED bị superseded và thay bằng STRUGGLED
                "trajectory_edges": [
                    {"module_id": "marketing-m1", "edge_type": "STRUGGLED"}
                ],
                "gateway": gateway,
            }
        )

    assert result["path"]["source"] == "agent"
    assert len(result["reasoning_traces"]) == 1
    assert "STRUGGLED" in result["reasoning_traces"][0]["trace"]
