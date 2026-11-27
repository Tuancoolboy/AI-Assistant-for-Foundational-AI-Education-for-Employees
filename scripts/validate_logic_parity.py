import json
import subprocess
import os
import tempfile
from datetime import datetime, timezone
import sys

from backend.services.bitemporal_logic import calculate_bitemporal_state
from backend.models.schemas import BitemporalData, TrajectoryEdge, ReasoningTrace, EdgeType

def get_dummy_data() -> BitemporalData:
    return BitemporalData(
        edges=[
            TrajectoryEdge(
                id="e1",
                module_id="m1",
                edge_type=EdgeType.COMPLETED,
                valid_from=datetime(2026, 6, 20, 10, 0, tzinfo=timezone.utc),
                system_recorded_at=datetime(2026, 6, 20, 10, 5, tzinfo=timezone.utc),
            ),
            TrajectoryEdge(
                id="e2",
                module_id="m2",
                edge_type=EdgeType.STRUGGLED,
                valid_from=datetime(2026, 6, 22, 14, 0, tzinfo=timezone.utc),
                system_recorded_at=datetime(2026, 6, 22, 14, 2, tzinfo=timezone.utc),
            )
        ],
        reasoning=[
            ReasoningTrace(
                timestamp=datetime(2026, 6, 21, 9, 0, tzinfo=timezone.utc),
                trace="User completed m1, looks good."
            ),
            ReasoningTrace(
                timestamp=datetime(2026, 6, 23, 10, 0, tzinfo=timezone.utc),
                trace="User struggled on m2, needs review."
            )
        ]
    )

def run_ts_logic(data: dict, slider: int, now_ts: float) -> dict:
    ts_code = f"""
import {{ calculateBitemporalState }} from '../src/frontend/lib/bitemporal-logic';

const data = {json.dumps(data)};
const slider = {slider};
const now_ts = {now_ts * 1000}; // JS uses ms

const result = calculateBitemporalState(data, slider, now_ts);
console.log(JSON.stringify(result));
"""
    fd, temp_path = tempfile.mkstemp(suffix=".ts", dir="scripts")
    with os.fdopen(fd, 'w') as f:
        f.write(ts_code)
    
    try:
        res = subprocess.run(["npx", "tsx", temp_path], capture_output=True, text=True, check=True)
        return json.loads(res.stdout)
    except subprocess.CalledProcessError as e:
        print("TS Execution Error:", e.stderr)
        raise
    finally:
        os.remove(temp_path)

def main():
    print("Starting Bitemporal Logic Parity Check...")
    
    dummy = get_dummy_data()
    now_ts = datetime(2026, 6, 24, 12, 0, tzinfo=timezone.utc).timestamp()
    
    # JSON in pydantic
    dummy_dict = dummy.model_dump(mode="json")
    
    sliders = [0, 50, 100]
    
    for slider in sliders:
        print(f"Testing slider={slider}...")
        
        # 1. Python output
        py_out = calculate_bitemporal_state(dummy, slider, now_ts)
        # convert datetime to string to match JSON
        if py_out["targetTime"]:
            # Dùng isoformat với Z ở cuối giống JavaScript
            py_out["targetTime"] = py_out["targetTime"].strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            
        if py_out["currentReasoning"]:
            py_out["currentReasoning"] = py_out["currentReasoning"].model_dump(mode="json")
        py_out["currentEdges"] = [e.model_dump(mode="json") for e in py_out["currentEdges"]]
        
        # 2. TS output
        ts_out = run_ts_logic(dummy_dict, slider, now_ts)
        
        # so sánh targetTime
        ts_time = ts_out.get("targetTime")
        py_time = py_out.get("targetTime")
        if ts_time or py_time:
            # So sánh đến giây
            assert ts_time[:19] == py_time[:19], f"targetTime mismatch: TS={ts_time}, PY={py_time}"
            
        assert len(py_out["currentEdges"]) == len(ts_out["currentEdges"]), "currentEdges length mismatch"
        for py_edge, ts_edge in zip(py_out["currentEdges"], ts_out["currentEdges"]):
            assert py_edge["module_id"] == ts_edge["module_id"], "edge module_id mismatch"
        
        py_reasoning = py_out.get("currentReasoning")
        ts_reasoning = ts_out.get("currentReasoning")
        if py_reasoning:
            assert py_reasoning["trace"] == ts_reasoning["trace"], "reasoning trace mismatch"
        else:
            assert not ts_reasoning, "reasoning should be null"

    print("SUCCESS: Parity check passed!")

if __name__ == "__main__":
    main()
