import { describe, expect, it } from "vitest";
import {
  canAccessModule,
  learningAccessDeniedMessage,
  type LearningAccessDecision,
} from "./learning-access";

function decision(
  overrides: Partial<LearningAccessDecision>,
): LearningAccessDecision {
  return {
    mode: "trial",
    source: "default-trial",
    roleId: "marketing",
    aiLevel: 2,
    organizationId: null,
    trialLimit: 3,
    allowedModuleIds: ["module-1", "module-2", "module-3"],
    blockingReason: null,
    ...overrides,
  };
}

describe("learning access", () => {
  it("allows every module for full access", () => {
    expect(
      canAccessModule(decision({ mode: "full", source: "organization" }), "x"),
    ).toBe(true);
  });

  it("limits trial users to the configured module ids", () => {
    const access = decision({});

    expect(canAccessModule(access, "module-1")).toBe(true);
    expect(canAccessModule(access, "module-4")).toBe(false);
  });

  it("blocks every module when entitlement is blocked", () => {
    const access = decision({
      mode: "blocked",
      source: "user",
      blockingReason: "Đã tạm khóa quyền học.",
    });

    expect(canAccessModule(access, "module-1")).toBe(false);
    expect(learningAccessDeniedMessage(access)).toBe("Đã tạm khóa quyền học.");
  });
});
