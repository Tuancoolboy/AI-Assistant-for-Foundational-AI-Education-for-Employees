from __future__ import annotations

import logging
from typing import Any

from backend.services.openai_helpers import chat_completion_json, is_openai_configured

from .data_loader import load_learning_context
from .ranking import build_candidate_pool, compute_fingerprint, rule_based_path, validate_llm_output
from .state import LearningPathState

logger = logging.getLogger(__name__)


def _merge_unique(*groups: list[str]) -> list[str]:
    values: list[str] = []
    for group in groups:
        values.extend(group)
    return list(dict.fromkeys(v for v in values if isinstance(v, str) and v.strip()))


def _demo_context(state: LearningPathState) -> dict[str, Any]:
    role_id = state.get("role_id") or "khac"
    ai_level = state.get("ai_level") or 0
    trajectory = state.get("trajectory_edges") or []
    return {
        "role_id": role_id,
        "ai_level": ai_level,
        "daily_tasks": [],
        "trajectory_edges": trajectory,
        "organization_id": None,
        "organization_name": None,
        "position_skill_slugs": [],
        "assessment_gap_module_ids": [],
        "manager_priority_module_ids": [],
        "assigned_path_module_ids": [],
        "assigned_path_title": None,
        "flow": "individual",
        "degraded": [],
    }


async def load_context_node(state: LearningPathState) -> dict[str, Any]:
    """Nạp dữ liệu thật từ Supabase rồi chuẩn hóa đầu vào cho graph."""

    try:
        mode = state.get("mode") or "demo"
        if mode == "supabase":
            gateway = state.get("gateway")
            if gateway is None:
                raise ValueError("Missing gateway for Supabase mode")
            loaded = await load_learning_context(gateway, state.get("user_id", ""))
        else:
            loaded = _demo_context(state)
    except Exception as exc:
        degraded = list(state.get("degraded") or [])
        degraded.append("context")
        logger.warning(
            "[learning-path] load_context failed degraded=%s fingerprint=%s",
            degraded,
            state.get("fingerprint") or "",
        )
        loaded = _demo_context(state)
        return {
            **loaded,
            "error": str(exc),
            "degraded": degraded,
            "fingerprint": compute_fingerprint({**state, **loaded}),
        }

    role_id = loaded.get("role_id") or state.get("role_id") or "khac"
    ai_level = loaded.get("ai_level")
    if ai_level is None:
        ai_level = state.get("ai_level") or 0
    # Cập nhật trajectory. Nếu data load từ DB có, dùng DB, nếu không lấy từ request.
    trajectory_edges = loaded.get("trajectory_edges")
    if trajectory_edges is None:
        trajectory_edges = list(state.get("trajectory_edges") or [])
    flow = loaded.get("flow") or ("company" if loaded.get("organization_id") else "individual")
    merged = {
        "role_id": role_id,
        "ai_level": ai_level,
        "daily_tasks": list(loaded.get("daily_tasks") or []),
        "trajectory_edges": trajectory_edges,
        "organization_id": loaded.get("organization_id"),
        "organization_name": loaded.get("organization_name"),
        "position_skill_slugs": list(loaded.get("position_skill_slugs") or []),
        "assessment_gap_module_ids": list(loaded.get("assessment_gap_module_ids") or []),
        "manager_priority_module_ids": list(loaded.get("manager_priority_module_ids") or []),
        "assigned_path_module_ids": list(loaded.get("assigned_path_module_ids") or []),
        "assigned_path_title": loaded.get("assigned_path_title"),
        "flow": flow,
        "degraded": list(loaded.get("degraded") or []),
    }
    merged["fingerprint"] = compute_fingerprint({**state, **merged, "mode": state.get("mode")})
    if merged["degraded"]:
        logger.info(
            "[learning-path] context degraded=%s fingerprint=%s",
            merged["degraded"],
            merged["fingerprint"],
        )
    return merged


async def check_cache_node(state: LearningPathState) -> dict[str, Any]:
    """Đọc cache theo fingerprint trước khi gọi LLM."""

    if state.get("mode") != "supabase" or state.get("force_refresh"):
        return {}

    gateway = state.get("gateway")
    if gateway is None:
        return {"degraded": list(dict.fromkeys([*(state.get("degraded") or []), "cache"]))}

    try:
        rows = await gateway.select(
            "learning_path_cache",
            query={
                "select": "fingerprint,path_json",
                "user_id": f"eq.{state.get('user_id')}",
                "fingerprint": f"eq.{state.get('fingerprint')}",
                "limit": "1",
            },
        )
    except Exception as exc:
        degraded = list(dict.fromkeys([*(state.get("degraded") or []), "cache"]))
        logger.info(
            "[learning-path] cache read degraded=%s fingerprint=%s",
            degraded,
            state.get("fingerprint") or "",
        )
        return {"degraded": degraded, "error": str(exc)}

    if not rows:
        return {}

    cached_path = rows[0].get("path_json")
    if not isinstance(cached_path, dict):
        return {}

    return {
        "cached_path": cached_path,
        "source": "cache",
        "cached": True,
    }


def route_after_cache(state: LearningPathState) -> str:
    if state.get("cached_path"):
        return "finalize_cache"
    return "build_pool"


async def finalize_cache_node(state: LearningPathState) -> dict[str, Any]:
    """Trả path từ cache ngay lập tức."""

    cached_path = state.get("cached_path")
    if not isinstance(cached_path, dict):
        return {}
    return {
        "path": cached_path,
        "cached": True,
        "source": "cache",
    }


async def build_pool_node(state: LearningPathState) -> dict[str, Any]:
    """Dựng candidate pool chỉ bằng metadata hợp lệ của role."""

    try:
        pool = build_candidate_pool(state.get("role_id") or "khac", int(state.get("ai_level") or 0))
        return {"candidate_pool": pool}
    except Exception as exc:
        degraded = list(dict.fromkeys([*(state.get("degraded") or []), "pool"]))
        logger.warning(
            "[learning-path] build_pool failed degraded=%s fingerprint=%s",
            degraded,
            state.get("fingerprint") or "",
        )
        return {"candidate_pool": [], "degraded": degraded, "error": str(exc)}


async def llm_select_node(state: LearningPathState) -> dict[str, Any]:
    """Gọi OpenAI chọn lộ trình từ pool metadata thôi."""

    if not is_openai_configured():
        degraded = list(dict.fromkeys([*(state.get("degraded") or []), "llm"]))
        return {"degraded": degraded}

    pool = state.get("candidate_pool") or []
    if not pool:
        degraded = list(dict.fromkeys([*(state.get("degraded") or []), "llm"]))
        return {"degraded": degraded}

    try:
        pool_lines: list[str] = []
        for module in pool:
            skills = module.get("skills") if isinstance(module.get("skills"), list) else []
            skills_text = ", ".join(str(skill) for skill in skills if isinstance(skill, str)) or "-"
            foundation = " | NỀN TẢNG" if module.get("isFoundation") else ""
            pool_lines.append(
                f"- {module.get('id')} | {module.get('title')} | level {module.get('level', 1)}{foundation} | kỹ năng: {skills_text}"
            )

        # Chuyển trajectory thành string (chỉ lấy 5 điểm gần nhất như Next.js)
        trajectory = state.get("trajectory_edges") or []
        trajectory_lines = []
        for edge in list(trajectory)[-5:]:
            module_id = edge.get("module_id")
            edge_type = edge.get("edge_type", "COMPLETED")
            trajectory_lines.append(f"- {module_id}: {edge_type}")
        trajectory_text = "\n".join(trajectory_lines) if trajectory_lines else "(chưa có)"

        system = "Bạn trả về JSON hợp lệ, tiếng Việt."
        user = (
            "Chọn và sắp xếp tối đa 8 module id từ danh sách sau.\n"
            "KHÔNG bịa id mới. Chỉ dùng id có trong danh sách.\n\n"
            f"Vị trí: {state.get('role_id') or 'khac'}\n"
            f"Level AI: {state.get('ai_level') or 0}\n"
            f"Luồng: {state.get('flow') or 'individual'}\n"
            f"Quỹ đạo học tập (Bitemporal Memory - 5 điểm uốn gần nhất):\n{trajectory_text}\n"
            "Danh sách metadata:\n"
            + "\n".join(pool_lines)
            + '\n\nDựa vào Graph Trajectory (quỹ đạo học tập đa thời gian) bên trên, hãy phát hiện phong cách học của học sinh (ví dụ: học sinh hay hổng lý thuyết nhưng mạnh thực hành). Đưa ra `reasoningTrace` giải thích tại sao bạn chọn module tiếp theo dựa trên quỹ đạo này.\n'
            + 'Trả JSON: {"summary":"...","reasoningTrace":"...","groups":[{"title":"...","reason":"...","moduleIds":["..."]}],"missingSkills":[]}'
        )
        raw = await chat_completion_json(system, user)
        if not raw:
            degraded = list(dict.fromkeys([*(state.get("degraded") or []), "llm"]))
            return {"degraded": degraded}
        return {"llm_raw": raw}
    except Exception as exc:
        degraded = list(dict.fromkeys([*(state.get("degraded") or []), "llm"]))
        logger.info(
            "[learning-path] llm degraded=%s fingerprint=%s",
            degraded,
            state.get("fingerprint") or "",
        )
        return {"degraded": degraded, "error": str(exc)}


async def validate_node(state: LearningPathState) -> dict[str, Any]:
    """Loại id bịa, id trùng và output rỗng từ LLM."""

    try:
        validated = validate_llm_output(
            state.get("llm_raw"),
            state.get("candidate_pool") or [],
            state,
        )
        if not validated:
            return {}
        reasoning_trace = validated.pop("reasoningTrace", None)
        return {
            "path": {"source": "agent", **validated},
            "reasoning_traces": [{"trace": reasoning_trace}] if reasoning_trace else [],
            "source": "agent",
            "cached": False,
        }
    except Exception as exc:
        degraded = list(dict.fromkeys([*(state.get("degraded") or []), "validate"]))
        logger.info(
            "[learning-path] validate degraded=%s fingerprint=%s",
            degraded,
            state.get("fingerprint") or "",
        )
        return {"degraded": degraded, "error": str(exc)}


def route_after_validate(state: LearningPathState) -> str:
    if state.get("path"):
        return "persist"
    return "fallback"


async def fallback_node(state: LearningPathState) -> dict[str, Any]:
    """Lộ trình rule-based cuối cùng, luôn phải thành công."""

    try:
        path = rule_based_path(state)
        return {"path": path, "source": "fallback", "cached": False}
    except Exception as exc:
        degraded = list(dict.fromkeys([*(state.get("degraded") or []), "fallback"]))
        logger.exception(
            "[learning-path] fallback crashed degraded=%s fingerprint=%s",
            degraded,
            state.get("fingerprint") or "",
        )
        return {
            "path": {
                "source": "fallback",
                "flow": state.get("flow") or "individual",
                "summary": "Lộ trình dự phòng theo vị trí và mức AI hiện tại.",
                "groups": [],
                "missingSkills": [],
                "fingerprint": state.get("fingerprint") or "",
            },
            "source": "fallback",
            "cached": False,
            "degraded": degraded,
            "error": str(exc),
        }


async def persist_node(state: LearningPathState) -> dict[str, Any]:
    """Ghi cache theo fingerprint, nhưng không chặn response nếu lỗi."""

    if state.get("mode") != "supabase" or state.get("source") == "cache":
        return {}

    gateway = state.get("gateway")
    path = state.get("path")
    if gateway is None or not isinstance(path, dict):
        return {}

    try:
        await gateway.upsert(
            "learning_path_cache",
            {
                "user_id": state.get("user_id"),
                "fingerprint": state.get("fingerprint"),
                "path_json": path,
            },
            on_conflict="user_id,fingerprint",
        )
        return {}
    except Exception as exc:
        degraded = list(dict.fromkeys([*(state.get("degraded") or []), "persist"]))
        logger.info(
            "[learning-path] persist degraded=%s fingerprint=%s",
            degraded,
            state.get("fingerprint") or "",
        )
        return {"degraded": degraded, "error": str(exc)}
