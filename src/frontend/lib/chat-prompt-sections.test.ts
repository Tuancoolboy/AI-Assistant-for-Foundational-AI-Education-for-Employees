import { describe, expect, it } from "vitest";
import {
  buildEmployeePromptSections,
  buildManagerPromptSections,
} from "./chat-prompt-sections";

describe("chat-prompt-sections", () => {
  it("keeps the employee core sections stable", () => {
    const sections = buildEmployeePromptSections({
      displayName: "Lan",
      roleLabel: "Nhân viên marketing",
      userAddress: "chị Lan",
      casualAddress: "chị",
      currentMessage: "Em muốn xem thử thôi",
      curriculumSummary: "",
      extraSkillSummary: "",
      companySummary: "",
      ahaSummary: "",
    });

    expect(sections.map((section) => section.id)).toMatchInlineSnapshot(`
      [
        "persona",
        "voice",
        "mission",
        "response-format",
        "progress-rule",
        "coach-boundary",
        "clarify-policy",
        "repair-basics",
        "format-basics",
        "style-reminder",
      ]
    `);
  });

  it("injects only the relevant conditional sections", () => {
    const sections = buildEmployeePromptSections({
      displayName: "Lan",
      roleLabel: "Nhân viên marketing",
      userAddress: "chị Lan",
      casualAddress: "chị",
      currentMessage:
        "Em cần sửa lại câu trả lời theo dạng checklist, bảng và báo cáo tổng hợp",
      curriculumSummary: "",
      extraSkillSummary: "Bài Kỹ năng khác",
      companySummary: "",
      ahaSummary: "",
    });

    expect(sections.map((section) => section.id)).toMatchInlineSnapshot(`
      [
        "persona",
        "voice",
        "mission",
        "response-format",
        "progress-rule",
        "coach-boundary",
        "clarify-policy",
        "repair-basics",
        "format-basics",
        "style-reminder",
        "repair-rules",
        "decision-rules",
        "extra-skill-rules",
        "concrete-example-rules",
      ]
    `);
  });

  it("adds concrete example rules for invoice and receivable questions", () => {
    const section = buildEmployeePromptSections({
      displayName: "Lan",
      roleLabel: "Nhân viên kế toán",
      userAddress: "chị Lan",
      casualAddress: "chị",
      currentMessage:
        "Cho tôi ví dụ cụ thể đối chiếu hóa đơn với công nợ bằng một bảng mẫu",
      curriculumSummary: "",
      extraSkillSummary: "",
      companySummary: "",
      ahaSummary: "",
    }).find((item) => item.id === "concrete-example-rules");

    expect(section?.content).toContain("## Bảng dữ liệu giả định");
    expect(section?.content).toContain("## Cách đối chiếu");
    expect(section?.content).toContain("## Prompt mẫu");
  });

  it("keeps manager prompt sections compact", () => {
    const sections = buildManagerPromptSections({
      displayName: "Huệ",
      friendly: "chị Huệ",
      currentMessage: "Cho em bản phân tích KPI gửi sếp",
    });

    expect(sections.map((section) => section.id)).toMatchInlineSnapshot(`
      [
        "persona",
        "voice",
        "mission",
        "response-format",
        "repair-rules",
        "analysis-rules",
        "decision-rules",
      ]
    `);
  });

  it("sets a high threshold for clarify and includes direct-answer examples", () => {
    const clarifySection = buildEmployeePromptSections({
      displayName: "Lan",
      roleLabel: "Nhân viên nhân sự",
      userAddress: "chị Lan",
      casualAddress: "chị",
      currentMessage: "Quy trình xin nghỉ phép là gì?",
      curriculumSummary: "",
      extraSkillSummary: "",
      companySummary: "",
      ahaSummary: "",
    }).find((section) => section.id === "clarify-policy");

    expect(clarifySection?.content).toContain("CHỈ sử dụng giao thức");
    expect(clarifySection?.content).toContain("Chỉ cho mình cách làm");
    expect(clarifySection?.content).toContain("Quy trình xin nghỉ phép là gì?");
    expect(clarifySection?.content).toContain("CẤM dùng `__CLARIFY__`");
  });

  it("grounds responses in supplied sources instead of assumptions", () => {
    const responseSection = buildEmployeePromptSections({
      displayName: "Lan",
      roleLabel: "Nhân viên nhân sự",
      userAddress: "chị Lan",
      casualAddress: "chị",
      currentMessage: "Hướng dẫn chính sách nghỉ phép",
      curriculumSummary: "",
      extraSkillSummary: "",
      companySummary: "",
      ahaSummary: "",
    }).find((section) => section.id === "response-format");

    expect(responseSection?.content).toContain("Chỉ được dùng dữ kiện");
    expect(responseSection?.content).toContain(
      "Em chưa có đủ thông tin để kết luận chính xác.",
    );
    expect(responseSection?.content).not.toContain("giả định an toàn");
  });
});
