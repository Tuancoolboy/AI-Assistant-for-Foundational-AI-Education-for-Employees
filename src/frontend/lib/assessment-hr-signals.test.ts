import { describe, expect, it } from "vitest";
import { buildHrAiLevelSignals, getAssessmentQuestionsForRole, HR_ROLE_ID } from "./assessment-hr";
import type { AssessmentAnswer } from "./assessment";

describe("buildHrAiLevelSignals — normalized signals (no questionId leakage)", () => {
  it("maps HR answers to scores/counts and keeps heuristicLevel", () => {
    const answers: AssessmentAnswer[] = [
      { questionId: "q4-ai-frequency", value: "daily" }, // score 6
      { questionId: "q-hr-prompt-skill", value: "3" }, // score 4
      { questionId: "q-hr-ai-usage", value: ["soan-vb", "tom-tat"] }, // +1 +1 = 2
      { questionId: "q-hr-data-knowledge", value: "ro" }, // score 4
    ];
    const signals = buildHrAiLevelSignals(answers, 4);
    expect(signals.aiFrequencyScore).toBe(6);
    expect(signals.promptSkillScore).toBe(4);
    expect(signals.aiForHrCount).toBe(2);
    expect(signals.dataSafetyScore).toBe(4);
    expect(signals.heuristicLevel).toBe(4);
  });

  it("returns zeros for missing answers (does not crash)", () => {
    const signals = buildHrAiLevelSignals([], 1);
    expect(signals.aiFrequencyScore).toBe(0);
    expect(signals.aiForHrCount).toBe(0);
    expect(signals.heuristicLevel).toBe(1);
  });
});

describe("HR survey set (regression guard)", () => {
  it("nhan-su returns 12 questions with exactly one free-text", () => {
    const qs = getAssessmentQuestionsForRole(HR_ROLE_ID);
    expect(qs.length).toBe(12);
    expect(qs.filter((q) => q.type === "free-text")).toHaveLength(1);
  });
});
