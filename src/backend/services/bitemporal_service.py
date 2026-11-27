import logging
from typing import Any

from backend.services.supabase_gateway import SupabaseGateway

logger = logging.getLogger(__name__)


async def get_student_trajectory(
    gateway: SupabaseGateway, student_id: str, target_time: str | None = None
) -> dict[str, Any]:
    """
    Fetch bitemporal trajectory for a student.
    Matches the logic in Next.js /api/van-hanh/trajectory/route.ts
    """
    try:
        if target_time:
            # Fetch snapshot at specific time using RPC
            data = await gateway.rpc(
                "get_student_trajectory_at",
                {
                    "p_student_id": student_id,
                    "p_target_time": target_time,
                },
            )
            return {"edges": data or [], "reasoning": []}
        else:
            # Fetch all edges for the student to allow client to determine time range
            data = await gateway.select(
                "temporal_knowledge_edges",
                query={
                    "select": "*",
                    "student_id": f"eq.{student_id}",
                    "order": "valid_from.asc",
                },
            )
            return {"edges": data or [], "reasoning": []}
    except Exception as exc:
        logger.error("[bitemporal_service] Failed to fetch trajectory: %s", str(exc))
        raise
