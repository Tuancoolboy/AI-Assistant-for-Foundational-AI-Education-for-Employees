import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AgentFlowInput } from "./path-agent-types";

const mocks = vi.hoisted(() => ({
  isOpenAIConfigured: vi.fn(),
  getOpenAIClient: vi.fn(),
  getOpenAIModel: vi.fn(() => "gpt-4o-mini"),
  buildFallbackPath: vi.fn(),
}));

vi.mock("@/lib/openai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/openai")>(
    "@/lib/openai",
  );
  return {
    ...actual,
    isOpenAIConfigured: mocks.isOpenAIConfigured,
    getOpenAIClient: mocks.getOpenAIClient,
    getOpenAIModel: mocks.getOpenAIModel,
  };
});

vi.mock("./path-agent-fallback", () => ({
  buildFallbackPath: mocks.buildFallbackPath,
}));

import { generatePath } from "./path-agent";

function makeInput(): AgentFlowInput {
  return {
    flow: "individual",
    roleId: "nhan-su",
    aiLevel: 2,
    skillSlugs: ["email-noi-bo"],
    goalTags: ["email", "process"],
    assessmentGapModuleIds: ["nhan-su-m1"],
    primaryTool: "claude",
    completedModuleIds: [],
    dailyTasks: ["email"],
    organizationName: null,
    departmentId: null,
    assignedPathTitle: null,
    assignedPathModules: [],
  };
}

describe("generatePath fallback handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildFallbackPath.mockImplementation(
      (input: AgentFlowInput, fingerprint: string) => ({
        source: "fallback",
        flow: input.flow,
        summary: "fallback",
        groups: [],
        orderedModuleIds: [],
        missingSkills: [],
        fingerprint,
      }),
    );
  });

  it("rơi về fallback khi thiếu key", async () => {
    mocks.isOpenAIConfigured.mockReturnValue(false);

    const result = await generatePath(makeInput(), "fp-1");

    expect(result.source).toBe("fallback");
    expect(mocks.buildFallbackPath).toHaveBeenCalledWith(
      expect.any(Object),
      "fp-1",
      expect.objectContaining({ reason: "no-key" }),
    );
  });

  it("rơi về fallback khi content rỗng", async () => {
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.getOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "   " } }],
          }),
        },
      },
    });

    await generatePath(makeInput(), "fp-2");

    expect(mocks.buildFallbackPath).toHaveBeenCalledWith(
      expect.any(Object),
      "fp-2",
      expect.objectContaining({ reason: "empty" }),
    );
  });

  it("rơi về fallback khi parse JSON fail", async () => {
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.getOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "khong-phai-json" } }],
          }),
        },
      },
    });

    await generatePath(makeInput(), "fp-3");

    expect(mocks.buildFallbackPath).toHaveBeenCalledWith(
      expect.any(Object),
      "fp-3",
      expect.objectContaining({ reason: "parse-fail" }),
    );
  });

  it("rơi về fallback khi OpenAI throw exception", async () => {
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.getOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("boom")),
        },
      },
    });

    await generatePath(makeInput(), "fp-4");

    expect(mocks.buildFallbackPath).toHaveBeenCalledWith(
      expect.any(Object),
      "fp-4",
      expect.objectContaining({ reason: "exception" }),
    );
  });
});
