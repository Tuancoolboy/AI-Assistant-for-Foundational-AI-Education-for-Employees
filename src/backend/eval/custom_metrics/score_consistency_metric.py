from __future__ import annotations


def calculate_score_consistency(ai_score: int, human_score: int) -> float:
    """Tính độ nhất quán của điểm số tự luận (từ 0.0 đến 1.0)."""
    delta = abs(ai_score - human_score)
    # Tối đa delta là 100 điểm, tỷ lệ nghịch với consistency score
    return max(0.0, 1.0 - (delta / 100.0))
