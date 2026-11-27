import { describe, expect, it } from "vitest";
import {
  buildAssistantChatInitKey,
  buildGreeting,
  normalizeStableMessageIds,
  resolveAssistantChatHistoryRequest,
  upsertMessageById,
} from "./use-assistant-chat";
import type { ResumeLesson } from "@/lib/resume-lesson";

describe("buildGreeting", () => {
  it("includes clickable resume lesson link for in-progress module", () => {
    const resumeLesson: ResumeLesson = {
      moduleId: "marketing-m1",
      title: "AI là gì? Nó giúp được gì cho marketing",
      href: "/lo-trinh/marketing-m1",
      status: "dang-hoc",
    };

    const text = buildGreeting(
      "marketing",
      "employee",
      "Đặng Minh Hải",
      resumeLesson,
    );

    expect(text).toContain("Chào Hải!");
    expect(text).toContain("phần Marketing");
    expect(text).toContain("đang học dở bài");
    expect(text).toContain(
      "[AI là gì? Nó giúp được gì cho marketing](/lo-trinh/marketing-m1)",
    );
    expect(text).not.toContain("«");
    expect(text).not.toContain("Em đang nối tiếp mạch trước");
  });

  it("shows next lesson link when nothing is in progress", () => {
    const resumeLesson: ResumeLesson = {
      moduleId: "marketing-m1",
      title: "AI là gì? Nó giúp được gì cho marketing",
      href: "/lo-trinh/marketing-m1",
      status: "chua-hoc",
    };

    const text = buildGreeting("marketing", "employee", "Đặng Minh Hải", resumeLesson);

    expect(text).toContain("Bài tiếp theo trên lộ trình:");
    expect(text).toContain("[AI là gì? Nó giúp được gì cho marketing](/lo-trinh/marketing-m1)");
  });

  it("omits lesson line when all modules are complete", () => {
    const text = buildGreeting("marketing", "employee", "Đặng Minh Hải", null);

    expect(text).not.toContain("/lo-trinh/");
    expect(text).toContain("Hỏi em về lộ trình");
  });
});

describe("assistant chat init key", () => {
  it("does not restart the session when only the resolved conversation id changes", () => {
    const baseKey = buildAssistantChatInitKey({
      roleId: "marketing",
      userType: "employee",
      fullName: "Đặng Minh Hải",
      preferredAddress: "neutral",
      noRestore: false,
      sessionLoadKey: "new-123",
      activeConversationId: null,
    });

    const resolvedKey = buildAssistantChatInitKey({
      roleId: "marketing",
      userType: "employee",
      fullName: "Đặng Minh Hải",
      preferredAddress: "neutral",
      noRestore: false,
      sessionLoadKey: "new-123",
      activeConversationId: "conv-456",
    });

    expect(resolvedKey).toBe(baseKey);
  });

  it("requests draft history for fresh sessions and selected history for stable sessions", () => {
    expect(
      resolveAssistantChatHistoryRequest("new-123", {
        noRestore: false,
        isNewConversation: false,
        resetContextOnFirstSend: false,
      }),
    ).toEqual({ draft: true });

    expect(
      resolveAssistantChatHistoryRequest("conv-456", {
        noRestore: false,
        isNewConversation: false,
        resetContextOnFirstSend: false,
      }),
    ).toEqual({ conversationId: "conv-456" });

    expect(
      resolveAssistantChatHistoryRequest("boot", {
        noRestore: false,
        isNewConversation: false,
        resetContextOnFirstSend: false,
      }),
    ).toBeUndefined();
  });
});

describe("assistant chat message identity", () => {
  it("normalizes duplicate stored ids once so React keys can use message.id", () => {
    const messages = normalizeStableMessageIds([
      { id: "stored-id", role: "user", content: "Câu hỏi" },
      { id: "stored-id", role: "assistant", content: "Câu trả lời" },
    ]);

    expect(messages.map((message) => message.id)).toEqual([
      "stored-id",
      "stored-id-duplicate-2",
    ]);
  });

  it("does not collide with an existing duplicate-style server id", () => {
    const messages = normalizeStableMessageIds([
      { id: "stored-id", role: "user", content: "Câu hỏi" },
      { id: "stored-id", role: "assistant", content: "Câu trả lời" },
      {
        id: "stored-id-duplicate-2",
        role: "assistant",
        content: "ID thật từ server",
      },
    ]);

    expect(new Set(messages.map((message) => message.id)).size).toBe(3);
    expect(messages.map((message) => message.id)).toEqual([
      "stored-id",
      "stored-id-duplicate-3",
      "stored-id-duplicate-2",
    ]);
  });

  it("updates the streaming placeholder in place without reordering messages", () => {
    const greeting = {
      id: "welcome-msg",
      role: "assistant" as const,
      content: "Chào bạn",
    };
    const user = {
      id: "u-1",
      role: "user" as const,
      content: "Quy trình xin nghỉ phép là gì?",
    };
    const placeholder = {
      id: "a-1",
      role: "assistant" as const,
      content: "",
    };
    const initial = [greeting, user, placeholder];

    const updated = upsertMessageById(initial, {
      ...placeholder,
      content: "Bước 1",
    });

    expect(updated.map((message) => message.id)).toEqual([
      "welcome-msg",
      "u-1",
      "a-1",
    ]);
    expect(updated[0]).toBe(greeting);
    expect(updated[1]).toBe(user);
    expect(updated[2].content).toBe("Bước 1");
  });
});
