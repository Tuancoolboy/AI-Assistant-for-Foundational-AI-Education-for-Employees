from __future__ import annotations

from typing import Any, Dict, List, Set


def calculate_coverage(expected: List[str], generated: List[str]) -> float:
    """Đo mức độ bao phủ (% module gợi ý khớp với kỳ vọng)."""
    if not expected:
        return 0.0
    
    expected_set: Set[str] = set(expected)
    generated_set: Set[str] = set(generated)
    
    overlap = expected_set.intersection(generated_set)
    return len(overlap) / len(expected_set)
