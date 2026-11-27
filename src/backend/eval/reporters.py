from __future__ import annotations

import json
import os
from typing import Any, Dict


def save_json_results(results: Dict[str, Any], filepath: str) -> None:
    """Save results dictionary to JSON file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
