from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from backend.services.learning_path_agent_service import run_learning_path_graph
from backend.services.types import NativeSession


class DummyGateway:
    async def select(self, table: str, *, query, **kwargs):
        return [{"role_id": "marketing", "ai_level": 1}]

    async def upsert(self, table: str, payload, *, on_conflict: str):
        return []


@pytest.mark.asyncio
async def test_run_learning_path_graph_returns_expected_shape():
    gateway = DummyGateway()
    fake_graph = SimpleNamespace(
        ainvoke=AsyncMock(
            return_value={
                "path": {"source": "agent", "summary": "ok"},
                "cached": False,
            }
        )
    )
    session = NativeSession(mode="demo", user_id="u1", email=None, is_manager=False)

    with patch(
        "backend.services.learning_path_agent_service.learning_path_agent",
        fake_graph,
    ), patch(
        "backend.services.openai_helpers.is_openai_configured",
        return_value=False,
    ):
        result = await run_learning_path_graph(session, {"roleId": "marketing"}, gateway)

    assert result == {"path": {"source": "agent", "summary": "ok"}, "cached": False}


@pytest.mark.asyncio
async def test_run_learning_path_graph_falls_back_when_graph_raises():
    gateway = DummyGateway()
    fake_graph = SimpleNamespace(ainvoke=AsyncMock(side_effect=RuntimeError("boom")))
    session = NativeSession(mode="supabase", user_id="u1", email=None, is_manager=False)

    fallback_path = {
        "source": "fallback",
        "flow": "individual",
        "summary": "fallback",
        "groups": [{"title": "A", "reason": "B", "moduleIds": ["marketing-m1"]}],
        "missingSkills": [],
        "fingerprint": "fp",
    }

    with patch(
        "backend.services.learning_path_agent_service.learning_path_agent",
        fake_graph,
    ), patch(
        "backend.services.learning_path_agent_service.rule_based_path",
        return_value=fallback_path,
    ):
        result = await run_learning_path_graph(session, {"roleId": "marketing", "aiLevel": 1}, gateway)

    assert result["path"]["source"] == "fallback"
    assert result["path"]["fingerprint"] == "fp"
    assert result["cached"] is False


@pytest.mark.asyncio
async def test_run_learning_path_graph_keeps_preview_behavior():
    gateway = DummyGateway()
    session = NativeSession(mode="supabase", user_id="u1", email=None, is_manager=False)

    with patch(
        "backend.services.learning_path_agent_service.get_modules_for_role",
        return_value=[
            {
                "id": "marketing-m1",
                "title": "Nền tảng AI cho marketing",
                "level": 1,
                "sort_order": 1,
                "skills": ["nen-tang-ai"],
                "isFoundation": True,
            }
        ],
    ):
        result = await run_learning_path_graph(
            session,
            {"roleId": "marketing", "aiLevel": 1, "skillSlugs": ["nen-tang-ai"]},
            gateway,
        )

    assert result["path"]["source"] == "preview"
    assert result["path"]["flow"] == "company"
    assert result["path"]["fingerprint"]
    assert result["cached"] is False
