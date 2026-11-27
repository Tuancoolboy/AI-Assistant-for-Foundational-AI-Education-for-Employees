import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMessageBubble } from "@/components/assistant-chat-messages";

describe("assistant chat link render safety", () => {
  it("escapes HTML-like strings when rendered as React text children", () => {
    const maliciousLabel = '<img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(
      createElement(
        "a",
        {
          href: "/lo-trinh/marketing-m1",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        maliciousLabel,
      ),
    );

    expect(html).not.toMatch(/<img[\s>]/);
    expect(html).toContain("&lt;img");
    expect(html).toContain('href="/lo-trinh/marketing-m1"');
  });

  it("renders assistant thinking in a collapsible details block", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantMessageBubble, {
        message: {
          id: "a-1",
          role: "assistant",
          content: "Kết luận cuối cùng.",
          thinking: "- Dữ kiện 1\n- Dữ kiện 2",
        },
        variant: "full",
      }),
    );

    expect(html).toContain("<details");
    expect(html).toContain("Quá trình xử lý");
    expect(html).toContain("Kết luận cuối cùng.");
  });
});
