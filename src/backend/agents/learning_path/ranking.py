from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from backend.services.learning_data import get_modules_for_role

SKILL_LABELS: dict[str, str] = {
    "nen-tang-ai": "Nền tảng AI cơ bản",
    "viet-prompt": "Viết prompt hiệu quả",
    "an-toan-du-lieu": "An toàn dữ liệu khi dùng AI",
    "van-ban-hanh-chinh": "Soạn văn bản hành chính",
    "loc-cv": "Lọc CV tuyển dụng",
    "email-noi-bo": "Viết email nội bộ",
    "cham-cong-nghi-phep": "Chấm công & nghỉ phép",
    "tom-tat-tai-lieu": "Tóm tắt tài liệu & biên bản",
}

MAX_MODULES = 8


def skill_label(slug: str) -> str:
    return SKILL_LABELS.get(slug, slug.replace("-", " ").strip() or slug)


def _uniq(values: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(v for v in values if isinstance(v, str) and v.strip()))


def _int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return default


def _read_str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _module_skills(module: dict[str, Any]) -> list[str]:
    skills = module.get("skills")
    if not isinstance(skills, list):
        return []
    return _uniq(str(skill) for skill in skills if isinstance(skill, str))


def _module_is_foundation(module: dict[str, Any]) -> bool:
    return bool(module.get("isFoundation"))


def _module_sort_order(module: dict[str, Any]) -> int:
    return _int(module.get("sort_order"), _int(module.get("sortOrder"), 0))


def _module_level(module: dict[str, Any]) -> int:
    return _int(module.get("level"), 1)


def _module_title(module: dict[str, Any]) -> str:
    title = _read_str(module.get("title"))
    return title or _read_str(module.get("id"))


def compute_fingerprint(context: dict[str, Any]) -> str:
    payload = {
        "mode": context.get("mode") or "",
        "flow": context.get("flow") or "",
        "role_id": context.get("role_id") or "",
        "ai_level": _int(context.get("ai_level"), 0),
        "trajectory_edges": sorted(_uniq(
            f'{edge.get("module_id", "")}:{edge.get("edge_type", "")}'
            for edge in context.get("trajectory_edges") or []
            if isinstance(edge, dict)
        )),
        "organization_id": context.get("organization_id") or "",
        "position_skill_slugs": sorted(_uniq(context.get("position_skill_slugs") or [])),
        "assessment_gap_module_ids": sorted(_uniq(context.get("assessment_gap_module_ids") or [])),
        "manager_priority_module_ids": sorted(_uniq(context.get("manager_priority_module_ids") or [])),
        "assigned_path_module_ids": sorted(_uniq(context.get("assigned_path_module_ids") or [])),
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def build_candidate_pool(role_id: str, ai_level: int) -> list[dict[str, Any]]:
    modules = get_modules_for_role(role_id, ai_level)
    pool: list[dict[str, Any]] = []
    for module in modules:
        pool.append(
            {
                "id": module["id"],
                "title": _module_title(module),
                "level": _module_level(module),
                "roleId": role_id,
                "skills": _module_skills(module),
                "isFoundation": _module_is_foundation(module),
                "sortOrder": _module_sort_order(module),
            }
        )
    return pool


def infer_assessment_gap_module_ids(role_id: str, ai_level: int) -> list[str]:
    catalog = build_candidate_pool(role_id, ai_level)
    if ai_level <= 1:
        return [module["id"] for module in catalog if _module_level(module) == 1]
    if ai_level <= 3:
        return [module["id"] for module in catalog if _module_level(module) == 2]
    return [module["id"] for module in catalog if _module_level(module) >= 3]


def _module_index(pool: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {module["id"]: module for module in pool if isinstance(module.get("id"), str)}


def _priority_bucket(module: dict[str, Any], context: dict[str, Any]) -> int:
    module_id = module["id"]
    gap_ids = set(_uniq(context.get("assessment_gap_module_ids") or []))
    priority_ids = set(_uniq(context.get("manager_priority_module_ids") or []))
    assigned_ids = set(_uniq(context.get("assigned_path_module_ids") or []))
    if module_id in gap_ids:
        return 0
    if module_id in priority_ids:
        return 1
    if module_id in assigned_ids:
        return 2
    if _module_is_foundation(module):
        return 3
    return 4


def _sort_ids(ids: Iterable[str], pool_index: dict[str, dict[str, Any]], context: dict[str, Any]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for module_id in ids:
        if module_id in seen:
            continue
        module = pool_index.get(module_id)
        if not module:
            continue
        seen.add(module_id)
        ordered.append(module_id)

    ordered.sort(
        key=lambda module_id: (
            _priority_bucket(pool_index[module_id], context),
            _module_level(pool_index[module_id]),
            _module_sort_order(pool_index[module_id]),
            module_id,
        )
    )
    return ordered


def _filter_pool(context: dict[str, Any], pool: list[dict[str, Any]]) -> list[dict[str, Any]]:
    completed = {
        str(edge.get("module_id")) for edge in context.get("trajectory_edges") or []
        if isinstance(edge, dict) and edge.get("edge_type", "COMPLETED") == "COMPLETED"
    }
    ai_level = _int(context.get("ai_level"), 0)
    filtered: list[dict[str, Any]] = []
    for module in pool:
        module_id = module["id"]
        if module_id in completed:
            continue
        if ai_level >= 5 and _module_level(module) == 1 and not _module_is_foundation(module):
            continue
        filtered.append(module)
    return filtered


def _group_by_skill(pool_index: dict[str, dict[str, Any]], ids: list[str]) -> list[dict[str, Any]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for module_id in ids:
        module = pool_index[module_id]
        skills = _module_skills(module)
        key = skill_label(skills[0]) if skills else "Lộ trình theo vai trò"
        groups[key].append(module_id)
    return [
        {
            "title": title,
            "reason": "Các bài cùng chủ đề để học theo cụm nhỏ, dễ áp dụng hơn.",
            "moduleIds": group_ids,
        }
        for title, group_ids in groups.items()
    ]


def _group_with_buckets(pool_index: dict[str, dict[str, Any]], ordered_ids: list[str], context: dict[str, Any]) -> list[dict[str, Any]]:
    gap_ids = set(_uniq(context.get("assessment_gap_module_ids") or []))
    priority_ids = set(_uniq(context.get("manager_priority_module_ids") or []))
    assigned_ids = set(_uniq(context.get("assigned_path_module_ids") or []))

    buckets: list[tuple[str, str, list[str]]] = []
    remaining: list[str] = []
    for module_id in ordered_ids:
        if module_id in gap_ids:
            if not buckets or buckets[-1][0] != "gap":
                buckets.append(("gap", "Bù lỗ hổng đánh giá trước để đỡ học lệch nền.", []))
            buckets[-1][2].append(module_id)
            continue
        if module_id in priority_ids:
            if not buckets or buckets[-1][0] != "priority":
                buckets.append(("priority", "Ưu tiên theo gợi ý quản lý trước khi mở rộng.", []))
            buckets[-1][2].append(module_id)
            continue
        if module_id in assigned_ids:
            if not buckets or buckets[-1][0] != "assigned":
                buckets.append(("assigned", "Bám theo lộ trình công ty đang giao.", []))
            buckets[-1][2].append(module_id)
            continue
        remaining.append(module_id)

    groups = [
        {
            "title": "Bù gap",
            "reason": "Ưu tiên lấp chỗ thiếu để học phần sau chắc hơn.",
            "moduleIds": group_ids,
        }
        for kind, _, group_ids in buckets
        if kind == "gap"
    ]
    groups.extend(
        {
            "title": "Ưu tiên quản lý",
            "reason": "Đây là phần được quản lý nhấn mạnh trước.",
            "moduleIds": group_ids,
        }
        for kind, _, group_ids in buckets
        if kind == "priority"
    )
    groups.extend(
        {
            "title": "Lộ trình công ty",
            "reason": "Các module trong lộ trình đang được giao.",
            "moduleIds": group_ids,
        }
        for kind, _, group_ids in buckets
        if kind == "assigned"
    )
    if remaining:
        groups.extend(_group_by_skill(pool_index, remaining))
    return groups


def _missing_skills(context: dict[str, Any], pool: list[dict[str, Any]]) -> list[str]:
    target_slugs = _uniq(context.get("position_skill_slugs") or [])
    if not target_slugs:
        return []
    available = {
        skill
        for module in pool
        for skill in _module_skills(module)
    }
    return [skill_label(slug) for slug in target_slugs if slug not in available]


def validate_llm_output(
    raw: dict[str, Any] | None,
    pool: list[dict[str, Any]],
    context: dict[str, Any],
) -> dict[str, Any] | None:
    if not raw or not isinstance(raw, dict):
        return None
    raw_groups = raw.get("groups")
    if not isinstance(raw_groups, list):
        return None
    filtered_pool = _filter_pool(context, [module for module in pool if isinstance(module, dict)])
    pool_index = _module_index(filtered_pool)
    if not pool_index:
        return None

    seen: set[str] = set()
    groups: list[dict[str, Any]] = []
    for raw_group in raw_groups:
        if not isinstance(raw_group, dict):
            continue
        raw_ids = raw_group.get("moduleIds")
        if not isinstance(raw_ids, list):
            continue
        ids = [
            module_id
            for module_id in raw_ids
            if isinstance(module_id, str) and module_id in pool_index and module_id not in seen
        ]
        if not ids:
            continue
        ids = _sort_ids(ids, pool_index, context)
        seen.update(ids)
        groups.append(
            {
                "title": _read_str(raw_group.get("title")) or "Lộ trình",
                "reason": _read_str(raw_group.get("reason")),
                "moduleIds": ids,
            }
        )

    if not groups:
        return None

    ordered_ids = _sort_ids(
        (module_id for group in groups for module_id in group["moduleIds"]),
        pool_index,
        context,
    )[:MAX_MODULES]
    if not ordered_ids:
        return None

    keep = set(ordered_ids)
    groups = [
        {
            **group,
            "moduleIds": [module_id for module_id in group["moduleIds"] if module_id in keep],
        }
        for group in groups
        if any(module_id in keep for module_id in group["moduleIds"])
    ]

    summary = _read_str(raw.get("summary")) or "Lộ trình học AI cá nhân hóa theo vai trò và mức hiện tại."
    missing_skills = []
    raw_missing = raw.get("missingSkills")
    if isinstance(raw_missing, list):
        missing_skills = [skill_label(item) for item in raw_missing if isinstance(item, str) and item.strip()]

    inferred_missing = _missing_skills(context, filtered_pool)
    for item in inferred_missing:
        if item not in missing_skills:
            missing_skills.append(item)

    if not groups or not ordered_ids:
        return None

    return {
        "flow": context.get("flow") or ("company" if context.get("organization_id") else "individual"),
        "summary": summary,
        "reasoningTrace": _read_str(raw.get("reasoningTrace")),
        "groups": groups,
        "missingSkills": missing_skills,
        "fingerprint": context.get("fingerprint") or compute_fingerprint(context),
    }


def rule_based_path(context: dict[str, Any]) -> dict[str, Any]:
    role_id = _read_str(context.get("role_id")) or "khac"
    ai_level = _int(context.get("ai_level"), 0)
    pool = context.get("candidate_pool")
    if not isinstance(pool, list) or not pool:
        pool = build_candidate_pool(role_id, ai_level)
    filtered_pool = _filter_pool(context, [module for module in pool if isinstance(module, dict)])
    pool_index = _module_index(filtered_pool)
    ordered_ids = _sort_ids(pool_index.keys(), pool_index, context)[:MAX_MODULES]
    groups = (
        _group_with_buckets(pool_index, ordered_ids, context)
        if context.get("flow") == "company" or context.get("organization_id")
        else _group_by_skill(pool_index, ordered_ids)
    )
    groups = [group for group in groups if group.get("moduleIds")]
    summary = (
        "Lộ trình bám kỹ năng công ty và mức hiện tại, ưu tiên bù gap trước."
        if context.get("flow") == "company" or context.get("organization_id")
        else "Lộ trình theo vị trí và mức AI hiện tại, đi từ nền tảng đến thực hành."
    )
    return {
        "source": "fallback",
        "flow": context.get("flow") or ("company" if context.get("organization_id") else "individual"),
        "summary": summary,
        "groups": groups,
        "missingSkills": _missing_skills(context, filtered_pool),
        "fingerprint": context.get("fingerprint") or compute_fingerprint(context),
    }
