import { describe, expect, it } from "vitest";
import { ROLES } from "./roles";
import {
  LEARNING_TIERS,
  MODULE_TIER_MAP,
  buildTierMapFromModules,
  buildTierViews,
  gateQuizModuleId,
  getGateQuiz,
  getModuleTier,
  isModuleLocked,
  parseGateTier,
  type TierGateInput,
} from "./learning-tiers";

describe("learning-tiers — tier assignment", () => {
  it("has 5 fixed tiers (Phase-3: thêm tier 5 Master+)", () => {
    expect(LEARNING_TIERS.map((t) => t.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps tier labels aligned with the canonical LMS taxonomy", () => {
    expect(LEARNING_TIERS.map((t) => t.label)).toEqual([
      "Cơ bản",
      "Nâng cao",
      "Nâng trình",
      "Master",
      "Master+",
    ]);
  });

  it("maps level 1 → tier 1 and level 3 → tier 4", () => {
    for (const role of Object.values(ROLES)) {
      for (const m of role.modules) {
        if (m.level === 1) expect(getModuleTier(m.id)).toBe(1);
        if (m.level === 3) expect(getModuleTier(m.id)).toBe(4);
      }
    }
  });

  it("splits level 2 modules across tier 2 and tier 3", () => {
    // kinh-doanh có 2 module level 2 (m3, m4) → 1 vào tier 2, 1 vào tier 3.
    expect(getModuleTier("kinh-doanh-m3")).toBe(2);
    expect(getModuleTier("kinh-doanh-m4")).toBe(3);
  });

  it("covers every module in the map", () => {
    for (const role of Object.values(ROLES)) {
      for (const m of role.modules) {
        expect(MODULE_TIER_MAP[m.id]).toBeGreaterThanOrEqual(1);
        expect(MODULE_TIER_MAP[m.id]).toBeLessThanOrEqual(4);
      }
    }
  });

  it("maps DB-only level 5 modules to tier 5", () => {
    const tierMap = buildTierMapFromModules([
      { id: "db-m1", level: 1 },
      { id: "db-m2", level: 2 },
      { id: "db-m3", level: 2 },
      { id: "db-m4", level: 3 },
      { id: "db-m5", level: 4 },
      { id: "db-m6", level: 5 },
    ]);

    expect(tierMap["db-m4"]).toBe(4);
    expect(tierMap["db-m5"]).toBe(4);
    expect(tierMap["db-m6"]).toBe(5);
  });
});

describe("learning-tiers — gate quiz", () => {
  it("builds gate quiz module id + parses it back", () => {
    expect(gateQuizModuleId("kinh-doanh", 2)).toBe("kinh-doanh-tier2-quiz");
    expect(parseGateTier("kinh-doanh-tier2-quiz")).toBe(2);
    expect(parseGateTier("kinh-doanh-m1")).toBeNull();
  });

  it("returns up to 3 questions reusing the role quiz pool", () => {
    const q = getGateQuiz("kinh-doanh", 1);
    expect(q.length).toBeGreaterThan(0);
    expect(q.length).toBeLessThanOrEqual(3);
    expect(q[0]).toHaveProperty("correctIndex");
  });
});

describe("learning-tiers — sequential gating", () => {
  // kinh-doanh: tier1 {m1,m2}, tier2 {m3}, tier3 {m4}, tier4 {m5,m6}
  const selected = [
    "kinh-doanh-m1",
    "kinh-doanh-m2",
    "kinh-doanh-m3",
    "kinh-doanh-m4",
    "kinh-doanh-m5",
    "kinh-doanh-m6",
  ];

  function input(over: Partial<TierGateInput> = {}): TierGateInput {
    return {
      selectedModuleIds: selected,
      progress: {},
      passedGateModuleIds: new Set(),
      ...over,
    };
  }

  it("mọi tier đều mở (bỏ khoá tuần tự) để học tự do", () => {
    const views = buildTierViews("kinh-doanh", input());
    expect(views.map((v) => v.tier)).toEqual([1, 2, 3, 4]);
    expect(views.every((v) => v.unlocked)).toBe(true);
  });

  it("vẫn tính allModulesDone/gatePassed để hiển thị, không dùng để khoá", () => {
    const views = buildTierViews(
      "kinh-doanh",
      input({
        progress: {
          "kinh-doanh-m1": "hoan-thanh",
          "kinh-doanh-m2": "hoan-thanh",
        },
        passedGateModuleIds: new Set(["kinh-doanh-tier1-quiz"]),
      }),
    );
    expect(views[0].allModulesDone).toBe(true);
    expect(views[0].gatePassed).toBe(true);
    // Tier sau vẫn mở dù chưa xong tier trước.
    expect(views[1].unlocked).toBe(true);
  });

  it("isModuleLocked luôn false (không chặn bài nào)", () => {
    expect(isModuleLocked("kinh-doanh", "kinh-doanh-m3", input())).toBe(false);
    expect(isModuleLocked("kinh-doanh", "kinh-doanh-m1", input())).toBe(false);
    expect(isModuleLocked("kinh-doanh", "ngoai-tap", input())).toBe(false);
  });
});
