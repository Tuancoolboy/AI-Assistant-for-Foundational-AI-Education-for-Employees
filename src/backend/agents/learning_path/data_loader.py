from __future__ import annotations

import asyncio
from collections.abc import Awaitable
from typing import Any

from backend.services.constants import VALID_ROLES

from .ranking import infer_assessment_gap_module_ids


def _uniq(values: list[str]) -> list[str]:
    return list(dict.fromkeys(v for v in values if isinstance(v, str) and v.strip()))


def _read_text(value: Any) -> str | None:
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
        parsed = int(str(value))
    except (TypeError, ValueError):
        return None
    return parsed


def _first_row(rows: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    if not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


async def _safe_select(
    gateway: Any,
    table: str,
    query: dict[str, str],
    degraded: list[str],
    label: str,
) -> list[dict[str, Any]]:
    try:
        rows = await gateway.select(table, query=query)
    except Exception:
        degraded.append(label)
        return []
    if not isinstance(rows, list):
        degraded.append(label)
        return []
    return [row for row in rows if isinstance(row, dict)]


def _normalize_position_skill_slug(row: dict[str, Any]) -> str | None:
    skill = row.get("skills")
    if isinstance(skill, dict):
        return _read_text(skill.get("slug"))
    if isinstance(skill, list):
        for item in skill:
            if isinstance(item, dict):
                slug = _read_text(item.get("slug"))
                if slug:
                    return slug
    return _read_text(row.get("skill_slug"))


async def _load_position_skill_slugs(
    gateway: Any,
    position_ids: list[str],
    degraded: list[str],
) -> list[str]:
    slugs: list[str] = []
    for position_id in position_ids:
        rows = await _safe_select(
            gateway,
            "position_skills",
            {
                "select": "skills(slug),skill_id",
                "position_id": f"eq.{position_id}",
            },
            degraded,
            "position_skills",
        )
        for row in rows:
            slug = _normalize_position_skill_slug(row)
            if slug:
                slugs.append(slug)
    return _uniq(slugs)


async def _load_assigned_path_context(
    gateway: Any,
    organization_id: str,
    user_id: str,
    degraded: list[str],
) -> dict[str, Any]:
    assignments = await _safe_select(
        gateway,
        "learning_assignments",
        {
            "select": "learning_path_id,status,learning_paths(title)",
            "organization_id": f"eq.{organization_id}",
            "user_id": f"eq.{user_id}",
            "status": "eq.active",
        },
        degraded,
        "learning_assignments",
    )
    if not assignments:
        return {
            "assigned_path_title": None,
            "assigned_path_module_ids": [],
            "manager_priority_module_ids": [],
        }

    path_ids = _uniq(
        [
            _read_text(row.get("learning_path_id")) or ""
            for row in assignments
            if _read_text(row.get("learning_path_id"))
        ]
    )

    path_titles: list[str] = []
    for row in assignments:
        path = row.get("learning_paths")
        if isinstance(path, dict):
            title = _read_text(path.get("title"))
            if title:
                path_titles.append(title)

    module_ids: list[str] = []
    manager_priority_ids: list[str] = []
    for path_id in path_ids:
        rows = await _safe_select(
            gateway,
            "learning_path_modules",
            {
                "select": "learning_path_id,legacy_module_id,sort_order,is_required,training_modules(title,level,legacy_module_id)",
                "learning_path_id": f"eq.{path_id}",
            },
            degraded,
            "learning_path_modules",
        )
        for row in rows:
            legacy_id = _read_text(row.get("legacy_module_id"))
            training_module = row.get("training_modules")
            if not legacy_id and isinstance(training_module, dict):
                legacy_id = _read_text(training_module.get("legacy_module_id"))
            if not legacy_id:
                continue
            module_ids.append(legacy_id)
            if row.get("is_required") is True:
                manager_priority_ids.append(legacy_id)

    assigned_path_title = None
    if path_titles:
        assigned_path_title = (
            path_titles[0]
            if len(path_titles) == 1
            else f"{path_titles[0]} (+{len(path_titles) - 1} lộ trình khác)"
        )

    if not manager_priority_ids:
        manager_priority_ids = module_ids[:]

    return {
        "assigned_path_title": assigned_path_title,
        "assigned_path_module_ids": _uniq(module_ids),
        "manager_priority_module_ids": _uniq(manager_priority_ids),
    }


async def load_learning_context(gateway: Any, user_id: str) -> dict[str, Any]:
    degraded: list[str] = []

    profile_task: Awaitable[list[dict[str, Any]]] = _safe_select(
        gateway,
        "profiles",
        {
            "select": "role_id,ai_level,daily_tasks",
            "id": f"eq.{user_id}",
            "limit": "1",
        },
        degraded,
        "profiles",
    )
    trajectory_task: Awaitable[list[dict[str, Any]]] = _safe_select(
        gateway,
        "temporal_knowledge_edges",
        {
            "select": "module_id,concept_id,edge_type,valid_from,valid_to,system_recorded_at",
            "student_id": f"eq.{user_id}",
            "order": "valid_from.asc",
        },
        degraded,
        "temporal_knowledge_edges",
    )
    membership_task: Awaitable[list[dict[str, Any]]] = _safe_select(
        gateway,
        "organization_members",
        {
            "select": "organization_id,organizations(name),department_id",
            "user_id": f"eq.{user_id}",
            "limit": "1",
        },
        degraded,
        "organization_members",
    )

    profile_rows, trajectory_rows, membership_rows = await asyncio.gather(
        profile_task,
        trajectory_task,
        membership_task,
    )

    profile = _first_row(profile_rows)
    membership = _first_row(membership_rows)
    organization_id = _read_text(membership.get("organization_id")) if membership else None
    organization_name = None
    if membership:
        org = membership.get("organizations")
        if isinstance(org, dict):
            organization_name = _read_text(org.get("name"))
    role_id = _read_text(profile.get("role_id")) if profile else None
    if role_id not in VALID_ROLES:
        role_id = role_id or "khac"
    ai_level = _read_int(profile.get("ai_level")) if profile else None
    if ai_level is None:
        ai_level = 0
    daily_tasks = []
    if profile:
        raw_daily_tasks = profile.get("daily_tasks")
        if isinstance(raw_daily_tasks, list):
            daily_tasks = _uniq([str(item) for item in raw_daily_tasks if isinstance(item, str)])

    trajectory_edges = [
        row for row in trajectory_rows
        if isinstance(row, dict) and _read_text(row.get("module_id"))
    ]

    position_skill_slugs: list[str] = []
    assigned_path_title = None
    assigned_path_module_ids: list[str] = []
    manager_priority_module_ids: list[str] = []

    if organization_id:
        member_positions = await _safe_select(
            gateway,
            "member_positions",
            {
                "select": "position_id",
                "user_id": f"eq.{user_id}",
                "organization_id": f"eq.{organization_id}",
            },
            degraded,
            "member_positions",
        )
        position_ids = _uniq(
            [
                _read_text(row.get("position_id")) or ""
                for row in member_positions
                if _read_text(row.get("position_id"))
            ]
        )
        if position_ids:
            position_skill_slugs = await _load_position_skill_slugs(gateway, position_ids, degraded)
        assigned_context = await _load_assigned_path_context(gateway, organization_id, user_id, degraded)
        assigned_path_title = assigned_context["assigned_path_title"]
        assigned_path_module_ids = assigned_context["assigned_path_module_ids"]
        manager_priority_module_ids = assigned_context["manager_priority_module_ids"]

    if not manager_priority_module_ids:
        manager_priority_module_ids = []

    assessment_gap_module_ids = infer_assessment_gap_module_ids(role_id, ai_level)
    flow = "company" if organization_id else "individual"

    if position_skill_slugs:
        position_skill_slugs = _uniq(position_skill_slugs)

    return {
        "role_id": role_id,
        "ai_level": ai_level,
        "daily_tasks": daily_tasks,
        "trajectory_edges": trajectory_edges,
        "reasoning_traces": [],
        "organization_id": organization_id,
        "organization_name": organization_name,
        "position_skill_slugs": position_skill_slugs,
        "assessment_gap_module_ids": assessment_gap_module_ids,
        "manager_priority_module_ids": manager_priority_module_ids,
        "assigned_path_module_ids": assigned_path_module_ids,
        "assigned_path_title": assigned_path_title,
        "flow": flow,
        "degraded": degraded,
    }
