import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantChatMessageList } from "./assistant-chat-messages";

describe("AssistantChatMessageList", () => {
  it("renders messages after stored ids have been normalized", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantChatMessageList, {
        messages: [
          { id: "stored-id", role: "user", content: "Câu hỏi đầu" },
          {
            id: "stored-id-duplicate-2",
            role: "assistant",
            content: "Câu trả lời đầu",
          },
        ],
        typing: false,
        variant: "full",
      }),
    );

    expect(html).toContain("Câu hỏi đầu");
    expect(html).toContain("Câu trả lời đầu");
  });

  it("keeps an empty streaming placeholder invisible", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantChatMessageList, {
        messages: [
          { id: "u-1", role: "user", content: "Câu hỏi" },
          { id: "a-1", role: "assistant", content: "" },
        ],
        typing: true,
        variant: "full",
      }),
    );

    expect(html).toContain("Câu hỏi");
    expect(html).not.toContain("rounded-tl-sm");
  });

  it("does not repeat a thinking block when the answer content starts with it", () => {
    const thinking =
      "- Mục tiêu: hướng dẫn đối chiếu hóa đơn\n- Dữ kiện: người học làm kế toán";
    const html = renderToStaticMarkup(
      createElement(AssistantChatMessageList, {
        messages: [
          {
            id: "a-1",
            role: "assistant",
            thinking,
            content: `Quá trình xử lý\n${thinking}\n\nCác bước thực hành:\n1. Chuẩn bị dữ liệu.`,
          },
        ],
        typing: false,
        variant: "full",
      }),
    );

    expect(html.match(/Quá trình xử lý/g)).toHaveLength(1);
    expect(html.match(/Mục tiêu: hướng dẫn đối chiếu hóa đơn/g)).toHaveLength(1);
    expect(html).toContain("Các bước thực hành");
  });

  it("softens the legacy harsh closing line in stored assistant messages", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantChatMessageList, {
        messages: [
          {
            id: "a-1",
            role: "assistant",
            content:
              "Việc này giúp bạn thực hành tốt hơn. Học xong bài này bạn tự làm được, không cần hỏi lại nữa nha.",
          },
        ],
        typing: false,
        variant: "full",
      }),
    );

    expect(html).toContain("Cần ví dụ thêm cứ nhắn em nha");
    expect(html).not.toContain("không cần hỏi " + "lại nữa");
  });

  it("hides legacy structured thinking/final tags from visible assistant content", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantChatMessageList, {
        messages: [
          {
            id: "a-1",
            role: "assistant",
            content:
              "<thinking>Không được lộ dòng này.</thinking><final>Đây là câu trả lời sạch cho mentor.</final>",
          },
        ],
        typing: false,
        variant: "full",
      }),
    );

    expect(html).toContain("Đây là câu trả lời sạch cho mentor");
    expect(html).not.toContain("Không được lộ dòng này");
    expect(html).not.toContain("&lt;thinking&gt;");
    expect(html).not.toContain("&lt;final&gt;");
  });

  it("hides legacy sentinel markers with or without colon", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantChatMessageList, {
        messages: [
          {
            id: "a-1",
            role: "assistant",
            content:
              "__THINKING__ Đang xử lý nội bộ\n__FINAL__ Đây là câu trả lời cuối.",
          },
        ],
        typing: false,
        variant: "full",
      }),
    );

    expect(html).toContain("Đây là câu trả lời cuối");
    expect(html).not.toContain("__THINKING__");
    expect(html).not.toContain("__FINAL__");
  });
});
