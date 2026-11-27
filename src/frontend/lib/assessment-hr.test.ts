import { describe, expect, it } from "vitest";
import {
  calculateHrAssessmentResult,
  getAssessmentQuestionsForRole,
  HR_ASSESSMENT_QUESTIONS,
} from "./assessment-hr";

describe("HR assessment questions", () => {
  it("preserves the existing HR question composition", () => {
    expect(getAssessmentQuestionsForRole("nhan-su")).toHaveLength(12);
    expect(
      HR_ASSESSMENT_QUESTIONS.some((question) => question.id === "q-hr-recurring"),
    ).toBe(true);
  });

  it("keeps the generic 6-question survey for other roles", () => {
    expect(getAssessmentQuestionsForRole("marketing")).toHaveLength(6);
  });

  it("uses the K2 vibe-code survey (11 câu: đo level + công cụ + khai thác khó khăn)", () => {
    const qs = getAssessmentQuestionsForRole("vibe-code");
    expect(qs).toHaveLength(11);
    expect(qs.some((q) => q.id === "q-vc-agent")).toBe(true);
    // Có câu hỏi công cụ code đang dùng.
    expect(qs.some((q) => q.id === "q-vc-editor")).toBe(true);
    // Có câu khai thác khó khăn khi vibe code.
    expect(qs.some((q) => q.id === "q-vc-struggles")).toBe(true);
    // Tổng điểm tối đa phải < 23 → aiLevel < 5 → không bao giờ tự skip bài Cấp 1.
    const maxScore = qs.reduce((sum, q) => {
      const best = Math.max(0, ...(q.options ?? []).map((o) => o.score ?? 0));
      return sum + best;
    }, 0);
    expect(maxScore).toBeLessThan(23);
  });

  it("offers a director/leadership seniority option", () => {
    const position = getAssessmentQuestionsForRole("nhan-su").find(
      (q) => q.id === "q1-position",
    );
    expect(position?.options?.some((o) => o.value === "director")).toBe(true);
  });

  it.each([
    ["never", "0", 1],
    ["weekly", "1", 2],
    ["daily", "2", 3],
    ["daily", "4", 3],
  ])(
    "classifies existing HR answers without promoting prompt skill to automation",
    (frequency, promptSkill, expectedLevel) => {
      const result = calculateHrAssessmentResult([
        { questionId: "q4-ai-frequency", value: frequency },
        { questionId: "q5-ai-skill", value: promptSkill },
      ]);

      expect(result.aiLevel).toBe(expectedLevel);
    },
  );

  it("supports explicit future automation and agent evidence only", () => {
    const automation = calculateHrAssessmentResult([
      { questionId: "q5-ai-skill", value: "4" },
      { questionId: "q-hr-automation", value: "yes" },
    ]);
    const agent = calculateHrAssessmentResult([
      { questionId: "q5-ai-skill", value: "4" },
      { questionId: "q-hr-agent", value: "yes" },
    ]);

    expect(automation.aiLevel).toBe(4);
    expect(agent.aiLevel).toBe(5);
  });

  it("keeps the legacy skip decision consistent with HR aiLevel", () => {
    const result = calculateHrAssessmentResult([
      { questionId: "q5-ai-skill", value: "4" },
      { questionId: "q-hr-agent", value: "yes" },
    ]);

    expect(result.aiLevel).toBe(5);
    expect(result.skipBasicModules).toBe(true);
  });
});
