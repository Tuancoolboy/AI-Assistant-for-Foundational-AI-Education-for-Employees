import { describe, expect, it, vi, beforeEach } from "vitest";
import { classifyAiLevel, type AiLevelSignals } from "./assessment-level-agent";

// Mock openai module so tests do not need a real API key.
vi.mock("@/lib/openai", () => ({
  isOpenAIConfigured: vi.fn(() => false),
  getOpenAIClient: vi.fn(() => null),
  getOpenAIModel: vi.fn(() => "gpt-4o-mini"),
}));

const baseSignals: AiLevelSignals = {
  aiFrequencyScore: 0,
  promptSkillScore: 0,
  aiToolsCount: 0,
  aiForHrCount: 0,
  dataSafetyScore: 0,
  heuristicLevel: 1,
};

describe("classifyAiLevel — heuristic fallback (no OpenAI key)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns heuristic source when isOpenAIConfigured=false", async () => {
    const result = await classifyAiLevel(baseSignals);
    expect(result.source).toBe("heuristic");
  });

  it("level is clamped to 1-5 for heuristicLevel=0", async () => {
    const result = await classifyAiLevel({ ...baseSignals, heuristicLevel: 0 });
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.level).toBeLessThanOrEqual(5);
  });

  it("level is clamped to 1-5 for heuristicLevel=6", async () => {
    const result = await classifyAiLevel({ ...baseSignals, heuristicLevel: 6 });
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.level).toBeLessThanOrEqual(5);
    expect(result.level).toBe(5);
  });

  it("passes heuristicLevel=3 through", async () => {
    const result = await classifyAiLevel({ ...baseSignals, heuristicLevel: 3 });
    expect(result.level).toBe(3);
  });

  it("returns levelLabel and levelDesc as non-empty strings", async () => {
    const result = await classifyAiLevel({ ...baseSignals, heuristicLevel: 2 });
    expect(typeof result.levelLabel).toBe("string");
    expect(result.levelLabel.length).toBeGreaterThan(0);
    expect(typeof result.levelDesc).toBe("string");
    expect(result.levelDesc.length).toBeGreaterThan(0);
  });
});

describe("classifyAiLevel — agent parse fallback", () => {
  it("falls back to heuristic when agent returns invalid JSON level", async () => {
    const { isOpenAIConfigured, getOpenAIClient } = await import("@/lib/openai");
    vi.mocked(isOpenAIConfigured).mockReturnValue(true);
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"level": "bad"}' } }],
          }),
        },
      },
    } as never);

    const result = await classifyAiLevel({ ...baseSignals, heuristicLevel: 2 });
    // "bad" → NaN → fallback heuristic
    expect(result.source).toBe("heuristic");
    expect(result.level).toBe(2);
  });

  it("falls back to heuristic on network exception", async () => {
    const { isOpenAIConfigured, getOpenAIClient } = await import("@/lib/openai");
    vi.mocked(isOpenAIConfigured).mockReturnValue(true);
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("Network failure")),
        },
      },
    } as never);

    const result = await classifyAiLevel({ ...baseSignals, heuristicLevel: 4 });
    expect(result.source).toBe("heuristic");
    expect(result.level).toBe(4);
  });

  it("uses agent level when valid and clamps 1-5", async () => {
    const { isOpenAIConfigured, getOpenAIClient } = await import("@/lib/openai");
    vi.mocked(isOpenAIConfigured).mockReturnValue(true);
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"level": 3, "reason": "khá quen"}' } }],
          }),
        },
      },
    } as never);

    const result = await classifyAiLevel({ ...baseSignals, heuristicLevel: 1 });
    expect(result.source).toBe("agent");
    expect(result.level).toBe(3);
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.level).toBeLessThanOrEqual(5);
  });
});
