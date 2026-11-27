from datetime import datetime, timezone
from typing import Dict, Any, Optional

from backend.models.schemas import BitemporalData


def calculate_bitemporal_state(
    data: Optional[BitemporalData],
    slider_value: int,
    now_timestamp: float
) -> Dict[str, Any]:
    """
    Equivalent to calculateBitemporalState in src/frontend/lib/bitemporal-logic.ts
    """
    if not data or not data.edges:
        return {
            "currentEdges": [],
            "currentReasoning": None,
            "targetTime": None
        }

    # valid_from in Python schema is datetime
    timestamps = [e.valid_from.timestamp() * 1000 for e in data.edges]
    min_time = min(timestamps)
    max_time = max(now_timestamp * 1000, *timestamps)
    time_span = max_time - min_time

    target_timestamp = min_time + (time_span * slider_value) / 100
    target_time_obj = datetime.fromtimestamp(target_timestamp / 1000, tz=timezone.utc)

    current_edges = [
        e for e in data.edges
        if (e.valid_from.timestamp() * 1000) <= target_timestamp
    ]

    current_reasoning = None
    for r in data.reasoning:
        if (r.timestamp.timestamp() * 1000) <= target_timestamp:
            current_reasoning = r

    return {
        "currentEdges": current_edges,
        "currentReasoning": current_reasoning,
        "targetTime": target_time_obj
    }
