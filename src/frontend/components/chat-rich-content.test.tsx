import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatRichContent } from "./chat-rich-content";

describe("ChatRichContent", () => {
  it("keeps user-tone content on light foreground classes", () => {
    const html = renderToStaticMarkup(
      <ChatRichContent
        text={"Tin nhắn user\n- Ý 1\n- Ý 2"}
        tone="user"
        variant="full"
      />,
    );

    expect(html).toContain("text-brand-foreground");
    expect(html).not.toContain("text-ink");
  });

  it("keeps one ordered list even when items are separated by blank lines", () => {
    const html = renderToStaticMarkup(
      <ChatRichContent
        text={"1. Bước một\n\n1. Bước hai\n\n1. Bước ba"}
        tone="assistant"
        variant="full"
      />,
    );

    expect((html.match(/<ol/g) ?? []).length).toBe(1);
    expect((html.match(/<li/g) ?? []).length).toBe(3);
  });

  it("renders pipe markdown tables as responsive tables", () => {
    const html = renderToStaticMarkup(
      <ChatRichContent
        text={
          "| Hóa đơn | Số tiền | Trạng thái |\n|---|---:|---|\n| HD001 | 1.500.000 | Khớp |\n| HD002 | 900.000 | Lệch |"
        }
        tone="assistant"
        variant="full"
      />,
    );

    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("HD001");
    expect(html).not.toContain("|---|---:|---|");
  });

  it("normalizes streamed assistant headings and stuck sentences", () => {
    const html = renderToStaticMarkup(
      <ChatRichContent
        text={
          "Để làm nhanh:## Bước 1: Chuẩn bị dữ liệu\nKiểm tra dữ liệu.Deep Learning giúp dò bất thường chính xác.Bạn nên lưu bảng."
        }
        tone="assistant"
        variant="full"
      />,
    );

    expect(html).toContain("Bước 1: Chuẩn bị dữ liệu");
    expect(html).not.toContain("Để làm nhanh:##");
    expect(html).toContain("dữ liệu. Deep Learning");
    expect(html).toContain("chính xác. Bạn");
  });
});
