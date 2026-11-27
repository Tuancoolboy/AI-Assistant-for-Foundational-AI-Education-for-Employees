import { describe, expect, it } from "vitest";
import {
  roadmapReducer,
  initRoadmapState,
  groupPercent,
  totalPercent,
  type GroupNode,
  type RoadmapState,
} from "./roadmap-store";

const sampleGroups: GroupNode[] = [
  {
    slug: "hr-tuyen-dung",
    label: "Tuyển dụng",
    percent: 50,
    levels: [
      {
        level: 1,
        label: "Cơ bản",
        modules: [
          { id: "mod-a", title: "Bài A", isSelected: true, status: "hoan-thanh" },
          { id: "mod-b", title: "Bài B", isSelected: true, status: "chua-hoc" },
        ],
      },
      {
        level: 2,
        label: "Nâng cao",
        modules: [
          { id: "mod-c", title: "Bài C", isSelected: false, status: "chua-hoc" },
        ],
      },
    ],
  },
];

describe("initRoadmapState", () => {
  it("builds selected/status maps from groups", () => {
    const state = initRoadmapState(sampleGroups);
    expect(state.selected["mod-a"]).toBe(true);
    expect(state.selected["mod-b"]).toBe(true);
    expect(state.selected["mod-c"]).toBe(false);
    expect(state.status["mod-a"]).toBe("hoan-thanh");
    expect(state.status["mod-b"]).toBe("chua-hoc");
    expect(state.pending.size).toBe(0);
  });
});

describe("roadmapReducer – TOGGLE_OPTIMISTIC", () => {
  it("flips selected and adds to pending", () => {
    const state = initRoadmapState(sampleGroups);
    const next = roadmapReducer(state, {
      type: "TOGGLE_OPTIMISTIC",
      moduleId: "mod-a",
      next: false,
    });
    expect(next.selected["mod-a"]).toBe(false);
    expect(next.pending.has("mod-a")).toBe(true);
  });

  it("updates percent immediately after optimistic flip", () => {
    const state = initRoadmapState(sampleGroups);
    // mod-a: selected+hoan-thanh, mod-b: selected+chua-hoc → 50%
    expect(groupPercent(state, ["mod-a", "mod-b", "mod-c"])).toBe(50);

    // Bỏ tích mod-a → denom=1 (mod-b), done=0 → 0%
    const next = roadmapReducer(state, {
      type: "TOGGLE_OPTIMISTIC",
      moduleId: "mod-a",
      next: false,
    });
    expect(groupPercent(next, ["mod-a", "mod-b", "mod-c"])).toBe(0);
  });
});

describe("roadmapReducer – TOGGLE_CONFIRMED", () => {
  it("removes from pending after confirmed", () => {
    const state = initRoadmapState(sampleGroups);
    const afterOptimistic = roadmapReducer(state, {
      type: "TOGGLE_OPTIMISTIC",
      moduleId: "mod-b",
      next: false,
    });
    const afterConfirmed = roadmapReducer(afterOptimistic, {
      type: "TOGGLE_CONFIRMED",
      moduleId: "mod-b",
    });
    expect(afterConfirmed.pending.has("mod-b")).toBe(false);
    // value stays flipped
    expect(afterConfirmed.selected["mod-b"]).toBe(false);
  });
});

describe("roadmapReducer – TOGGLE_ROLLBACK", () => {
  it("restores previous value and removes from pending", () => {
    const state = initRoadmapState(sampleGroups);
    const afterOptimistic = roadmapReducer(state, {
      type: "TOGGLE_OPTIMISTIC",
      moduleId: "mod-a",
      next: false,
    });
    const afterRollback = roadmapReducer(afterOptimistic, {
      type: "TOGGLE_ROLLBACK",
      moduleId: "mod-a",
      prev: true,
    });
    expect(afterRollback.selected["mod-a"]).toBe(true);
    expect(afterRollback.pending.has("mod-a")).toBe(false);
  });
});

describe("groupPercent", () => {
  it("counts only selected modules in denominator", () => {
    const state = initRoadmapState(sampleGroups);
    // mod-c unselected → excluded from denom
    // denom=2 (mod-a, mod-b), done=1 (mod-a) → 50%
    expect(groupPercent(state, ["mod-a", "mod-b", "mod-c"])).toBe(50);
  });

  it("returns 0 when all unselected (denom=0)", () => {
    const state: RoadmapState = {
      selected: { "mod-x": false, "mod-y": false },
      status: { "mod-x": "hoan-thanh", "mod-y": "hoan-thanh" },
      pending: new Set(),
    };
    expect(groupPercent(state, ["mod-x", "mod-y"])).toBe(0);
  });
});

describe("totalPercent", () => {
  it("delegates to groupPercent over all module ids", () => {
    const state = initRoadmapState(sampleGroups);
    const all = ["mod-a", "mod-b", "mod-c"];
    expect(totalPercent(state, all)).toBe(groupPercent(state, all));
  });
});
