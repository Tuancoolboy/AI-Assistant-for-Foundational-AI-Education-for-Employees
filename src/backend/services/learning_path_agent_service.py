from __future__ import annotations

import asyncio
import logging
from typing import Any

from backend.agents.learning_path.graph import learning_path_agent
from backend.agents.learning_path.ranking import compute_fingerprint, rule_based_path
from backend.config import get_settings
from backend.services.learning_data import get_modules_for_role
from backend.services.types import NativeSession

logger = logging.getLogger(__name__)


def _read_str(value: Any) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def _read_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _uniq(values: list[str]) -> list[str]:
    return list(dict.fromkeys(v for v in values if isinstance(v, str) and v.strip()))


def _preview_path(role_id: str, ai_level: int) -> dict[str, Any]:
    modules = get_modules_for_role(role_id, ai_level)
    return {
        "source": "preview",
        "flow": "company",
        "summary": "Lộ trình xem trước cho quản lý.",
        "groups": [
            {
                "title": "Lộ trình theo vị trí",
                "reason": "Xem trước danh sách module theo vai trò và mức hiện tại.",
                "moduleIds": [module["id"] for module in modules][:8],
            }
        ],
        "missingSkills": [],
        "fingerprint": compute_fingerprint(
            {
                "mode": "preview",
                "flow": "company",
                "role_id": role_id,
                "ai_level": ai_level,
                "completed_module_ids": [],
                "organization_id": None,
                "position_skill_slugs": [],
                "assessment_gap_module_ids": [],
                "manager_priority_module_ids": [],
                "assigned_path_module_ids": [],
            }
        ),
    }


async def _resolve_minimal_context(
    session: NativeSession,
    body: dict[str, Any],
    gateway: Any,
) -> dict[str, Any]:
    role_id = _read_str(body.get("roleId"))
    ai_level = _read_int(body.get("aiLevel"))
    completed = body.get("completedModuleIds")
    completed_module_ids = _uniq(completed) if isinstance(completed, list) else []

    if session.mode == "supabase" and (role_id is None or ai_level is None):
        try:
            rows = await gateway.select(
                "profiles",
                query={
                    "select": "role_id,ai_level",
                    "id": f"eq.{session.user_id}",
                    "limit": "1",
                },
            )
        except Exception:
            rows = []
        if rows:
            row = rows[0] if isinstance(rows[0], dict) else {}
            if role_id is None:
                role_id = _read_str(row.get("role_id")) or role_id
            if ai_level is None:
                ai_level = _read_int(row.get("ai_level"))

    if role_id is None:
        role_id = "khac"
    if ai_level is None:
        ai_level = 0

    return {
        "mode": session.mode,
        "user_id": session.user_id,
        "role_id": role_id,
        "ai_level": ai_level,
        "completed_module_ids": completed_module_ids,
    }


async def run_learning_path_graph(
    session: NativeSession,
    body: dict[str, Any],
    gateway: Any,
) -> dict[str, Any]:
    if isinstance(body.get("skillSlugs"), list) and body.get("skillSlugs"):
        role_id = _read_str(body.get("roleId")) or "khac"
        ai_level = _read_int(body.get("aiLevel")) or 0
        path = _preview_path(role_id, ai_level)
        return {"path": path, "cached": False}

    state = await _resolve_minimal_context(session, body, gateway)
    state.update(
        {
            "gateway": gateway,
            "force_refresh": body.get("forceRefresh") is True,
            "hints": body,
        }
    )

    timeout_s = float(get_settings().langgraph_path_timeout_s)
    try:
        result = await asyncio.wait_for(
            learning_path_agent.ainvoke(state),
            timeout=timeout_s,
        )
        path = result.get("path")
        cached = bool(result.get("cached"))
        if not isinstance(path, dict):
            path = rule_based_path({**state, **result, "candidate_pool": result.get("candidate_pool") or []})
            cached = False
        return {"path": path, "cached": cached}
    except Exception as exc:
        logger.warning(
            "[learning-path] graph fallback: %s fingerprint=%s",
            exc,
            compute_fingerprint(state),
        )
        path = rule_based_path(state)
        return {"path": path, "cached": False}
