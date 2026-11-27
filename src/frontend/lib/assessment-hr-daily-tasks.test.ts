import { describe, expect, it } from "vitest";
import { calculateHrAssessmentResult } from "./assessment-hr";
import { resolveSuggestedModuleIds } from "./learning-path-selection";
import type { AssessmentAnswer } from "./assessment";

const HR = "nhan-su";

// Bộ trả lời HR tối thiểu: chọn 3 nhóm việc ở q3hr-tasks, level thấp (không skip).
function answers(tasks: string[]): AssessmentAnswer[] {
  return [
    { questionId: "q1-position", value: "mid" },
    { questionId: "q3hr-tasks", value: tasks },
    { questionId: "q4-ai-frequency", value: "tried" },
    { questionId: "q5-ai-skill", value: "1" },
  ];
}

describe("calculateHrAssessmentResult — dailyTasks bám đúng q3hr-tasks", () => {
  it("rút đúng nhóm việc đã chọn vào result.dailyTasks", () => {
    const tasks = ["hr-tuyen-dung", "hr-onboarding-ld", "hr-cb-luong"];
    const result = calculateHrAssessmentResult(answers(tasks));
    expect(result.dailyTasks).toEqual(tasks);
  });

  it("không chọn nhóm nào → dailyTasks rỗng (không bịa)", () => {
    const result = calculateHrAssessmentResult(answers([]).filter(
      (a) => a.questionId !== "q3hr-tasks",
    ));
    expect(result.dailyTasks).toEqual([]);
  });
});

describe("resolveSuggestedModuleIds — gợi ý bám phần đã chọn", () => {
  it("có khảo sát → gợi ý ÍT hơn toàn bộ kho (đúng phần đã chọn)", () => {
    const survey = calculateHrAssessmentResult(
      answers(["hr-tuyen-dung"]),
    );
    const suggested = resolveSuggestedModuleIds(HR, [], survey.aiLevel, survey);
    const all = resolveSuggestedModuleIds(HR, [], survey.aiLevel, null);
    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.length).toBeLessThan(all.length);
  });

  it("không khảo sát → giữ logic cũ (toàn bộ bài theo level)", () => {
    const ids = resolveSuggestedModuleIds(HR, [], 2, null);
    expect(ids.length).toBeGreaterThan(0);
  });
});
