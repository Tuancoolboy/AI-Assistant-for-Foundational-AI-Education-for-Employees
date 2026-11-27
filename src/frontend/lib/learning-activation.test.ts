import { describe, expect, it } from "vitest";
import {
  canAccessLearning,
  needsLearningActivation,
  type LearningActivationRecord,
} from "./learning-activation";

function record(overrides: Partial<LearningActivationRecord> = {}) {
  return {
    roleId: "kinh-doanh",
    learningActivated: false,
    learningActivatedAt: null,
    activationEmailSentAt: null,
    isManager: false,
    isPlatformAdmin: false,
    ...overrides,
  } satisfies LearningActivationRecord;
}

describe("learning activation gate", () => {
  it("does not block role-bearing learners while the activation gate is disabled", () => {
    const pendingLearner = record({ learningActivated: false });

    expect(needsLearningActivation()).toBe(false);
    expect(canAccessLearning(pendingLearner)).toBe(true);
  });

  it("does not treat missing onboarding role as an activation failure", () => {
    expect(canAccessLearning(record({ roleId: null }))).toBe(true);
  });

  it("keeps manager and platform admin records allowed for their own guarded flows", () => {
    expect(canAccessLearning(record({ roleId: null, isManager: true }))).toBe(true);
    expect(canAccessLearning(record({ roleId: null, isPlatformAdmin: true }))).toBe(
      true,
    );
  });
});
