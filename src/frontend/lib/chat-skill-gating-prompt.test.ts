import { describe, expect, it } from "vitest";
import { buildSkillGatingHint } from "./chat-skill-gating-prompt";
import type { SkillGatingResult } from "./chat-skill-gating";

const primary = {
  moduleId: "kinh-doanh-m1",
  title: "Viết email chốt sale",
  href: "/lo-trinh/kinh-doanh-m1",
  status: "hoan-thanh" as const,
  source: "curriculum" as const,
  skillSlug: null,
  summary: "Cách dùng AI viết email bán hàng",
};

describe("buildSkillGatingHint", () => {
  it("answered-learned: có link ôn lại + mức cà khịa", () => {
    const result: SkillGatingResult = {
      decision: "answered-learned",
      skillKey: "kinh-doanh-m1",
      primary,
      options: [primary],
      reaskCount: 3,
      emotionLevel: 2,
      bestMatchScore: 5,
    };
    const hint = buildSkillGatingHint(result);
    expect(hint).toContain("CASE A");
    expect(hint).toContain("/lo-trinh/kinh-doanh-m1");
    expect(hint).toContain("2/3");
  });

  it("must-learn: liệt kê bài + không cho đáp án + cần câu", () => {
    const result: SkillGatingResult = {
      decision: "must-learn",
      skillKey: "kinh-doanh-m2",
      primary: { ...primary, status: "chua-hoc" },
      options: [
        { ...primary, status: "chua-hoc" },
        { ...primary, moduleId: "m2", title: "Bài 2", href: "/lo-trinh/m2" },
      ],
      reaskCount: 0,
      emotionLevel: 0,
      bestMatchScore: 4,
    };
    const hint = buildSkillGatingHint(result);
    expect(hint).toContain("CASE B");
    expect(hint).toContain("KHÔNG cho đáp án");
    expect(hint).toContain("/lo-trinh/m2");
    expect(hint).toContain("Cần ví dụ thêm cứ nhắn em nha");
    expect(hint).not.toContain("không cần hỏi " + "lại nữa");
  });

  it("no-lesson: mời đăng Topic câu hỏi chưa có lời giải", () => {
    const result: SkillGatingResult = {
      decision: "no-lesson",
      skillKey: null,
      primary: null,
      options: [],
      reaskCount: 0,
      emotionLevel: 0,
      bestMatchScore: 1,
    };
    const hint = buildSkillGatingHint(result);
    expect(hint).toContain("CASE C");
    expect(hint).toContain("Topic câu hỏi chưa có lời giải");
  });
});
