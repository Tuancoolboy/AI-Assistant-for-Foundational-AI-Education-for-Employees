import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveApiSession: vi.fn(),
  loadLearningActivationRecord: vi.fn(),
  canAccessLearning: vi.fn(() => true),
  runLearningPathAgent: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  resolveApiSession: mocks.resolveApiSession,
}));

vi.mock("@/lib/learning-activation", () => ({
  loadLearningActivationRecord: mocks.loadLearningActivationRecord,
  canAccessLearning: mocks.canAccessLearning,
}));

vi.mock("@/lib/agent/path-agent-service", () => ({
  runLearningPathAgent: mocks.runLearningPathAgent,
}));

import { POST } from "./route";

describe("/api/agent/lo-trinh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveApiSession.mockResolvedValue({
      mode: "supabase",
      userId: "user-1",
    });
    mocks.loadLearningActivationRecord.mockResolvedValue({ activated: true });
    mocks.canAccessLearning.mockReturnValue(true);
    mocks.runLearningPathAgent.mockResolvedValue({
      path: {
        source: "agent",
        flow: "individual",
        summary: "Lộ trình agent",
        groups: [],
        orderedModuleIds: ["nhan-su-m1"],
        missingSkills: [],
        fingerprint: "fp-123",
      },
      source: "agent",
      cached: false,
    });
  });

  it("trả source top-level khi sinh mới", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent/lo-trinh", {
        method: "POST",
        body: JSON.stringify({ roleId: "nhan-su" }),
      }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      source: string;
      path: { source: string };
      cached: boolean;
    };

    expect(json.ok).toBe(true);
    expect(json.source).toBe("agent");
    expect(json.path.source).toBe("agent");
    expect(json.cached).toBe(false);
    expect(mocks.runLearningPathAgent).toHaveBeenCalledTimes(1);
  });

  it("giữ source từ cache khi có fingerprint khớp", async () => {
    mocks.runLearningPathAgent.mockResolvedValue({
      path: {
        source: "fallback",
        flow: "individual",
        summary: "Cached path",
        groups: [],
        orderedModuleIds: ["nhan-su-m1"],
        missingSkills: [],
        fingerprint: "fp-123",
      },
      source: "fallback",
      cached: true,
    });

    const response = await POST(
      new Request("http://localhost/api/agent/lo-trinh", {
        method: "POST",
        body: JSON.stringify({ roleId: "nhan-su" }),
      }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      source: string;
      path: { source: string };
      cached: boolean;
    };

    expect(json.ok).toBe(true);
    expect(json.source).toBe("fallback");
    expect(json.path.source).toBe("fallback");
    expect(json.cached).toBe(true);
    expect(mocks.runLearningPathAgent).toHaveBeenCalledTimes(1);
  });
});
