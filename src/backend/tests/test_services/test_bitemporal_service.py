import pytest
from unittest.mock import AsyncMock

from backend.services.bitemporal_service import get_student_trajectory


@pytest.mark.asyncio
async def test_get_student_trajectory_with_target_time():
    gateway = AsyncMock()
    gateway.rpc.return_value = [
        {"module_id": "m1", "edge_type": "COMPLETED"},
        {"module_id": "m2", "edge_type": "STRUGGLED"},
    ]

    result = await get_student_trajectory(
        gateway, "student-123", "2026-06-24T12:00:00Z"
    )

    gateway.rpc.assert_called_once_with(
        "get_student_trajectory_at",
        {
            "p_student_id": "student-123",
            "p_target_time": "2026-06-24T12:00:00Z",
        },
    )
    gateway.select.assert_not_called()

    assert result == {
        "edges": [
            {"module_id": "m1", "edge_type": "COMPLETED"},
            {"module_id": "m2", "edge_type": "STRUGGLED"},
        ],
        "reasoning": [],
    }


@pytest.mark.asyncio
async def test_get_student_trajectory_without_target_time():
    gateway = AsyncMock()
    gateway.select.return_value = [
        {"module_id": "m1", "edge_type": "COMPLETED"},
    ]

    result = await get_student_trajectory(gateway, "student-123")

    gateway.select.assert_called_once_with(
        "temporal_knowledge_edges",
        query={
            "select": "*",
            "student_id": "eq.student-123",
            "order": "valid_from.asc",
        },
    )
    gateway.rpc.assert_not_called()

    assert result == {
        "edges": [
            {"module_id": "m1", "edge_type": "COMPLETED"},
        ],
        "reasoning": [],
    }


@pytest.mark.asyncio
async def test_get_student_trajectory_handles_error():
    gateway = AsyncMock()
    gateway.select.side_effect = Exception("DB Error")

    with pytest.raises(Exception, match="DB Error"):
        await get_student_trajectory(gateway, "student-123")
