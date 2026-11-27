import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveFlowInput: vi.fn(),
  computeFingerprint: vi.fn(() => "fp-123"),
  buildDeptPreviewInput: vi.fn(),
  generatePath: vi.fn(),
  readCachedPath: vi.fn(),
  writeCachedPath: vi.fn(),
}));

vi.mock("./path-agent-input", () => ({
  resolveFlowInput: mocks.resolveFlowInput,
  computeFingerprint: mocks.computeFingerprint,
  buildDeptPreviewInput: mocks.buildDeptPreviewInput,
}));

vi.mock("./path-agent", () => ({
  generatePath: mocks.generatePath,
}));

vi.mock("./path-agent-cache", () => ({
  readCachedPath: mocks.readCachedPath,
  writeCachedPath: mocks.writeCachedPath,
}));

import { runLearningPathAgent } from "./path-agent-service";

describe("runLearningPathAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildDeptPreviewInput.mockReturnValue({ flow: "company" });
    mocks.resolveFlowInput.mockResolvedValue({
      flow: "individual",
      roleId: "nhan-su",
      aiLevel: 3,
      skillSlugs: ["email"],
      goalTags: ["email"],
      assessmentGapModuleIds: ["nhan-su-m1"],
      primaryTool: "claude",
      completedModuleIds: [],
      dailyTasks: ["email"],
      organizationName: null,
      departmentId: null,
      assignedPathTitle: null,
      assignedPathModules: [],
      organizationContextText: null,
    });
    mocks.generatePath.mockResolvedValue({
      source: "agent",
      flow: "individual",
      summary: "agent",
      groups: [],
      orderedModuleIds: ["nhan-su-m1"],
      missingSkills: [],
      fingerprint: "fp-123",
    });
    mocks.readCachedPath.mockResolvedValue(null);
    mocks.writeCachedPath.mockResolvedValue(undefined);
  });

  it("ưu tiên preview phòng ban và bỏ cache", async () => {
    const result = await runLearningPathAgent(
      { mode: "supabase", userId: "user-1" } as const,
      {
        skillSlugs: ["loc-cv"],
        roleId: "van-hanh",
        aiLevel: 2,
      },
    );

    expect(result.cached).toBe(false);
    expect(mocks.buildDeptPreviewInput).toHaveBeenCalledTimes(1);
    expect(mocks.resolveFlowInput).not.toHaveBeenCalled();
  });

  it("đọc cache trước khi generate", async () => {
    mocks.readCachedPath.mockResolvedValue({
      source: "fallback",
      flow: "individual",
      summary: "cached",
      groups: [],
      orderedModuleIds: ["nhan-su-m1"],
      missingSkills: [],
      fingerprint: "fp-123",
    });

    const result = await runLearningPathAgent(
      { mode: "supabase", userId: "user-1" } as const,
      {},
    );

    expect(result.cached).toBe(true);
    expect(mocks.generatePath).not.toHaveBeenCalled();
    expect(mocks.writeCachedPath).not.toHaveBeenCalled();
  });
});
