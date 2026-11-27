import { describe, expect, it } from "vitest";
import { buildClusterKey } from "./skill-gap-capture";

describe("buildClusterKey", () => {
  it("gom các cách hỏi gần giống về cùng cluster (bỏ dấu, sort token, bỏ từ thừa)", () => {
    const a = buildClusterKey("Viết email chốt sale thế nào?", "kinh-doanh");
    const b = buildClusterKey("email chốt sale viết thế nào", "kinh-doanh");
    expect(a).toBe(b);
  });

  it("câu khác chủ đề → cluster khác", () => {
    const a = buildClusterKey("viết email chốt sale", "kinh-doanh");
    const b = buildClusterKey("lập báo cáo công nợ", "ke-toan");
    expect(a).not.toBe(b);
  });

  it("role khác → cluster khác dù câu giống", () => {
    const a = buildClusterKey("dùng AI viết nội dung", "marketing");
    const b = buildClusterKey("dùng AI viết nội dung", "van-hanh");
    expect(a).not.toBe(b);
  });

  it("bỏ token ngắn (<3) và ký tự đặc biệt", () => {
    const key = buildClusterKey("AI là gì???", "khac");
    expect(key).toContain(":khac");
    expect(key).not.toContain("?");
  });
});
