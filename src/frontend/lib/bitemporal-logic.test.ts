import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateBitemporalState, BitemporalData } from "./bitemporal-logic";

describe("bitemporal-logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates state correctly for 0% slider", () => {
    const data: BitemporalData = {
      edges: [
        { id: "1", module_id: "m1", edge_type: "COMPLETED", valid_from: "2026-06-01T00:00:00Z", system_recorded_at: "2026-06-01T00:00:00Z" },
        { id: "2", module_id: "m2", edge_type: "STRUGGLED", valid_from: "2026-06-10T00:00:00Z", system_recorded_at: "2026-06-10T00:00:00Z" },
      ],
      reasoning: [
        { timestamp: "2026-06-01T00:00:00Z", trace: "Học sinh học rất nhanh m1." },
        { timestamp: "2026-06-10T00:00:00Z", trace: "Học sinh gặp khó khăn ở m2, cần bổ sung lý thuyết." },
      ]
    };

    const state = calculateBitemporalState(data, 0); // minTime = 2026-06-01
    expect(state.currentEdges).toHaveLength(1);
    expect(state.currentEdges[0].module_id).toBe("m1");
    expect(state.currentReasoning?.trace).toBe("Học sinh học rất nhanh m1.");
    expect(state.targetTime?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("calculates state correctly for 100% slider", () => {
    const data: BitemporalData = {
      edges: [
        { id: "1", module_id: "m1", edge_type: "COMPLETED", valid_from: "2026-06-01T00:00:00Z", system_recorded_at: "2026-06-01T00:00:00Z" },
        { id: "2", module_id: "m2", edge_type: "STRUGGLED", valid_from: "2026-06-10T00:00:00Z", system_recorded_at: "2026-06-10T00:00:00Z" },
      ],
      reasoning: [
        { timestamp: "2026-06-01T00:00:00Z", trace: "Học sinh học rất nhanh m1." },
        { timestamp: "2026-06-10T00:00:00Z", trace: "Học sinh gặp khó khăn ở m2, cần bổ sung lý thuyết." },
      ]
    };

    const state = calculateBitemporalState(data, 100); // maxTime = 2026-06-20 (system time)
    expect(state.currentEdges).toHaveLength(2);
    expect(state.currentReasoning?.trace).toBe("Học sinh gặp khó khăn ở m2, cần bổ sung lý thuyết.");
    expect(state.targetTime?.toISOString()).toBe("2026-06-20T00:00:00.000Z");
  });

  it("handles empty data", () => {
    const state = calculateBitemporalState(null, 50);
    expect(state.currentEdges).toEqual([]);
    expect(state.currentReasoning).toBeNull();
  });
});
