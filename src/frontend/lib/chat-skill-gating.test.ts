import { describe, expect, it } from "vitest";
import {
  collectGatingCandidates,
  mapEmotion,
  resolveSkillGating,
  type SkillGatingInput,
} from "./chat-skill-gating";
import type { LearningModuleRecord } from "./learning-modules-data";
import type { ExtraSkillLessonCatalogItem } from "./extra-skill-lessons";

function mod(id: string, title = id): LearningModuleRecord {
  return {
    id,
    role_id: "kinh-doanh",
    title,
    duration_min: 10,
    level: 1,
    sort_order: 0,
    summary: `Tóm tắt ${title}`,
    content: "",
    learnings: [],
    sections: [],
    practice_prompt: "",
    tool: null,
    toolReason: null,
    rubric: [],
    attached_file: null,
  };
}

function baseInput(over: Partial<SkillGatingInput> = {}): SkillGatingInput {
  return {
    roleId: "kinh-doanh",
    message: "viết email chốt sale thế nào",
    relevantModules: [],
    extraSkillMatch: null,
    progressByModuleId: {},
    priorReaskCount: 0,
    ...over,
  };
}

describe("mapEmotion", () => {
  it("maps reaskCount to emotion levels", () => {
    expect(mapEmotion(1)).toBe(0);
    expect(mapEmotion(2)).toBe(1);
    expect(mapEmotion(3)).toBe(2);
    expect(mapEmotion(4)).toBe(3);
    expect(mapEmotion(10)).toBe(3);
  });
});

describe("resolveSkillGating", () => {
  it("CASE A — đã học → answered-learned, reaskCount tăng, emotion map đúng", () => {
    const input = baseInput({
      relevantModules: [{ mod: mod("kinh-doanh-m1"), score: 5, status: "hoan-thanh" }],
      priorReaskCount: 2,
    });
    const res = resolveSkillGating(input);
    expect(res.decision).toBe("answered-learned");
    expect(res.skillKey).toBe("kinh-doanh-m1");
    expect(res.reaskCount).toBe(3);
    expect(res.emotionLevel).toBe(2);
    expect(res.primary?.href).toBe("/lo-trinh/kinh-doanh-m1");
  });

  it("CASE A — lần đầu hỏi lại (prior 0) → reaskCount 1, emotion 0", () => {
    const res = resolveSkillGating(
      baseInput({
        relevantModules: [{ mod: mod("m1"), score: 4, status: "hoan-thanh" }],
        priorReaskCount: 0,
      }),
    );
    expect(res.reaskCount).toBe(1);
    expect(res.emotionLevel).toBe(0);
  });

  it("CASE B — chưa học → must-learn, options ≤ 3, primary score cao nhất", () => {
    const input = baseInput({
      relevantModules: [
        { mod: mod("m-low"), score: 2, status: "chua-hoc" },
        { mod: mod("m-high"), score: 9, status: "dang-hoc" },
        { mod: mod("m-mid"), score: 5, status: "chua-hoc" },
        { mod: mod("m-extra"), score: 3, status: "chua-hoc" },
      ],
    });
    const res = resolveSkillGating(input);
    expect(res.decision).toBe("must-learn");
    expect(res.emotionLevel).toBe(0);
    expect(res.options.length).toBeLessThanOrEqual(3);
    expect(res.primary?.moduleId).toBe("m-high");
  });

  it("CASE C — không match (dưới ngưỡng) → no-lesson, options rỗng, bestMatchScore giữ điểm", () => {
    const res = resolveSkillGating(
      baseInput({
        relevantModules: [{ mod: mod("m1"), score: 1, status: "chua-hoc" }],
      }),
    );
    expect(res.decision).toBe("no-lesson");
    expect(res.options).toHaveLength(0);
    expect(res.primary).toBeNull();
    expect(res.bestMatchScore).toBe(1);
  });

  it("extra-skill match nhưng curriculum không đạt → vẫn ra option", () => {
    const extra: ExtraSkillLessonCatalogItem = {
      moduleId: "extra-canva",
      title: "Dùng Canva AI",
      roleId: "kinh-doanh",
      roleLabel: "Kinh doanh",
      skillSlug: "canva-ai",
      skillLabel: "Canva AI",
      summary: "Thiết kế nhanh bằng AI",
    };
    const res = resolveSkillGating(
      baseInput({
        relevantModules: [{ mod: mod("m1"), score: 1, status: "chua-hoc" }],
        extraSkillMatch: extra,
        progressByModuleId: { "extra-canva": "hoan-thanh" },
      }),
    );
    expect(res.decision).toBe("answered-learned");
    expect(res.skillKey).toBe("canva-ai");
    expect(res.primary?.source).toBe("extra-skill");
    expect(res.primary?.href).toBe("/lo-trinh/extra-canva?extra=1");
  });
});

describe("collectGatingCandidates", () => {
  it("không trùng bài giữa curriculum và extra", () => {
    const extra: ExtraSkillLessonCatalogItem = {
      moduleId: "dup",
      title: "Bài trùng",
      roleId: "kinh-doanh",
      roleLabel: "KD",
      skillSlug: "dup-skill",
      summary: "x",
    };
    const out = collectGatingCandidates({
      relevantModules: [{ mod: mod("dup"), score: 5, status: "hoan-thanh" }],
      extraSkillMatch: extra,
      progressByModuleId: {},
    });
    expect(out.filter((o) => o.moduleId === "dup")).toHaveLength(1);
  });
});
