import { beforeEach, describe, expect, it, vi } from "vitest";
import { evalNode, runChatEvaluation } from "./eval-node";

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  evalFaithfulness: vi.fn(),
  evalAnswerRelevancy: vi.fn(),
  evalContextRecall: vi.fn(),
  saveChatEvaluation: vi.fn(),
}));

vi.mock("@/lib/site-settings", () => ({
  getSetting: mocks.getSetting,
}));

vi.mock("@/lib/eval/eval-metrics", () => ({
  evalFaithfulness: mocks.evalFaithfulness,
  evalAnswerRelevancy: mocks.evalAnswerRelevancy,
  evalContextRecall: mocks.evalContextRecall,
}));

vi.mock("@/lib/eval/eval-persistence", () => ({
  saveChatEvaluation: mocks.saveChatEvaluation,
}));

describe("evalNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.evalFaithfulness.mockResolvedValue({ score: 0.9, reasoning: "ok" });
    mocks.evalAnswerRelevancy.mockResolvedValue({ score: 0.8, reasoning: "ok" });
    mocks.evalContextRecall.mockResolvedValue({ score: 0.7, reasoning: "ok" });
    mocks.saveChatEvaluation.mockResolvedValue(undefined);
  });

  it("does not let metadata force evaluation when DB setting is off", async () => {
    mocks.getSetting.mockResolvedValue(false);

    await evalNode({
      query: "Câu hỏi",
      response: "Câu trả lời",
      retrievedContexts: ["context"],
      userId: "user-1",
      metadata: {
        conversationId: "conversation-1",
        forceEval: true,
      },
    });

    expect(mocks.getSetting).toHaveBeenCalledWith("enable_chat_eval");
    expect(mocks.evalFaithfulness).not.toHaveBeenCalled();
    expect(mocks.saveChatEvaluation).not.toHaveBeenCalled();
  });

  it("skips graph-level eval when the route will evaluate final text", async () => {
    await evalNode({
      query: "Câu hỏi",
      response: "Raw answer",
      retrievedContexts: ["context"],
      userId: "user-1",
      metadata: {
        conversationId: "conversation-1",
        skipEval: true,
      },
    });

    expect(mocks.getSetting).not.toHaveBeenCalled();
    expect(mocks.evalFaithfulness).not.toHaveBeenCalled();
  });

  it("persists metrics for the final assistant response it receives", async () => {
    await runChatEvaluation({
      query: "Câu hỏi",
      response: "Câu trả lời cuối cùng đã cleanup",
      contexts: ["context"],
      userId: "user-1",
      conversationId: "conversation-1",
    });

    expect(mocks.evalFaithfulness).toHaveBeenCalledWith(
      "Câu trả lời cuối cùng đã cleanup",
      ["context"],
    );
    expect(mocks.evalAnswerRelevancy).toHaveBeenCalledWith(
      "Câu hỏi",
      "Câu trả lời cuối cùng đã cleanup",
    );
    expect(mocks.evalContextRecall).toHaveBeenCalledWith("Câu hỏi", ["context"]);
    expect(mocks.saveChatEvaluation).toHaveBeenCalledWith(
      "user-1",
      "conversation-1",
      {
        faithfulness: { score: 0.9, reasoning: "ok" },
        answerRelevancy: { score: 0.8, reasoning: "ok" },
        contextRecall: { score: 0.7, reasoning: "ok" },
      },
    );
  });
});
