import { describe, expect, it } from "vitest";
import { buildAhaReflectionsCsv } from "@/lib/platform-admin-aha-export";
import type { PlatformAdminAhaReflectionRow } from "@/lib/platform-admin-types";

const reflection: PlatformAdminAhaReflectionRow = {
  id: "aha-1",
  createdAt: "2026-06-24T08:30:00.000Z",
  userId: "user-1",
  userName: "Nguyễn Văn A",
  userEmail: "a@example.com",
  organizationId: "org-1",
  organizationName: "Công ty A",
  moduleId: "van-hanh-m1",
  moduleTitle: "Tóm tắt tài liệu vận hành",
  insight: 'Hiểu cách dùng "AI" để tóm tắt',
  nextAction: "Thử trong tuần này",
  visibility: "department",
};

describe("buildAhaReflectionsCsv", () => {
  it("exports the important Aha fields with an Excel-compatible BOM", () => {
    const csv = buildAhaReflectionsCsv([reflection]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Nguyễn Văn A"');
    expect(csv).toContain('"Tóm tắt tài liệu vận hành"');
    expect(csv).not.toContain('"van-hanh-m1"');
    expect(csv).toContain('"Hiểu cách dùng ""AI"" để tóm tắt"');
    expect(csv).toContain('"Phòng ban"');
  });

  it("neutralizes spreadsheet formulas from user-entered content", () => {
    const csv = buildAhaReflectionsCsv([
      { ...reflection, insight: "=HYPERLINK(\"https://example.com\")" },
    ]);

    expect(csv).toContain(
      '"\'=HYPERLINK(""https://example.com"")"',
    );
  });
});
