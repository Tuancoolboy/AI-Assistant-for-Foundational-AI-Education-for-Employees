import { describe, expect, it } from "vitest";
import { detectSensitiveData, getSafetyWarning } from "./safety";
import { redactSensitiveText } from "./chat-prompt-safety";

describe("safety", () => {
  it("detects phone-like numbers", () => {
    expect(detectSensitiveData("Số của khách: 0912345678")).toBe(true);
  });

  it("detects account keywords", () => {
    expect(detectSensitiveData("STK 123456789")).toBe(true);
    expect(detectSensitiveData("số tài khoản ngân hàng")).toBe(true);
  });

  it("detects password keywords", () => {
    expect(detectSensitiveData("mật khẩu wifi công ty")).toBe(true);
  });

  it("returns undefined for safe questions", () => {
    expect(getSafetyWarning("AI giúp em viết email thế nào?")).toBeUndefined();
  });

  it("returns warning for sensitive paste", () => {
    expect(getSafetyWarning("CMND 001234567890")).toContain("nhạy cảm");
  });

  it("stays consistent across repeated calls (no stateful lastIndex bug from global regex)", () => {
    const text = "STK 9876543210";
    expect(detectSensitiveData(text)).toBe(true);
    expect(detectSensitiveData(text)).toBe(true);
    expect(detectSensitiveData(text)).toBe(true);
  });

  it("does not flag unrelated short numeric context (giá tiền, năm)", () => {
    expect(detectSensitiveData("Ngân sách 50 triệu, năm 2026")).toBe(false);
  });
});

describe("redactSensitiveText - regression QA B-4 (PII echo leak)", () => {
  it("redacts BOTH CMND and STK when both appear in the same message", () => {
    const input =
      "Toi paste CMND cua ung vien: 023456789012, ho ten Nguyen Van A, so tai khoan 9876543210 - hay soan email chao mung";
    const result = redactSensitiveText(input);

    expect(result).not.toContain("023456789012");
    expect(result).not.toContain("9876543210");
  });

  it("redacts multiple bank account numbers in one message", () => {
    const input = "Chuyển từ STK 1111222233 sang STK 4444555566";
    const result = redactSensitiveText(input);

    expect(result).not.toContain("1111222233");
    expect(result).not.toContain("4444555566");
  });

  it("does not mangle unrelated short numbers (giá tiền, phần trăm)", () => {
    const result = redactSensitiveText("Gói 50 triệu đồng, giảm 20%");
    expect(result).toContain("50 triệu");
    expect(result).toContain("20%");
  });

  it("leaves clean text untouched", () => {
    const input = "Cho tôi ví dụ prompt viết email lịch sự";
    expect(redactSensitiveText(input)).toBe(input);
  });
});
