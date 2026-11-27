import { describe, expect, it } from "vitest";
import {
  appendChatStreamChunk,
  createChatStreamParseState,
} from "@/lib/chat-stream-parse";

describe("chat-stream-parse", () => {
  it("parses thinking lines then answer", () => {
    let state = createChatStreamParseState();
    ({ state } = appendChatStreamChunk(
      state,
      "__THINKING__:Đang đọc câu hỏi...\n__THINKING__:Kiểm tra dữ kiện...\n",
    ));
    expect(state.thinkingText).toBe("Kiểm tra dữ kiện...");
    expect(state.answerText).toBe("");

    ({ state } = appendChatStreamChunk(state, "Xin chào "));
    ({ state } = appendChatStreamChunk(state, "bạn!"));
    expect(state.answerText).toBe("Xin chào bạn!");
  });

  it("parses structured thinking and final answer blocks", () => {
    let state = createChatStreamParseState();
    ({ state } = appendChatStreamChunk(
      state,
      "<thinking>\n- Dữ kiện A\n- Dữ kiện B\n</thinking>\n<final>\nKết luận rõ ràng.\n</final>",
    ));

    expect(state.thinkingText).toContain("Dữ kiện A");
    expect(state.answerText).toContain("Kết luận rõ ràng.");
  });

  it("parses structured tags split across arbitrary chunks", () => {
    let state = createChatStreamParseState();
    for (const chunk of [
      "<think",
      "ing>\n- Dữ kiện A",
      "\n</think",
      "ing>\n<fi",
      "nal>Kết luận",
      " rõ ràng.</final>",
    ]) {
      ({ state } = appendChatStreamChunk(state, chunk));
    }

    expect(state.thinkingText).toContain("Dữ kiện A");
    expect(state.answerText).toBe("Kết luận rõ ràng.");
    expect(state.answerText).not.toContain("<final>");
  });

  it("does not leak partial tags when structured output starts with whitespace", () => {
    let state = createChatStreamParseState();
    ({ state } = appendChatStreamChunk(state, "\n<thi"));
    expect(state.answerText).toBe("");

    ({ state } = appendChatStreamChunk(
      state,
      "nking>Kiểm tra</thinking><final>Kết luận</fi",
    ));
    expect(state.thinkingText).toBe("Kiểm tra");
    expect(state.answerText).toBe("Kết luận");
  });
});
