import { describe, expect, it } from "vitest";
import { findRelevantModulesForQuery } from "./chat-knowledge-curriculum";
import { getLearningModulesByRole } from "./learning-modules-data";

describe("findRelevantModulesForQuery", () => {
  const modules = getLearningModulesByRole("kinh-doanh", 0);

  it("trả module liên quan kèm status từ progressByModuleId", () => {
    const first = modules[0]!;
    const progress = { [first.id]: "hoan-thanh" };
    // Query lấy ngay tiêu đề module đầu để chắc chắn có match.
    const out = findRelevantModulesForQuery(modules, first.title, progress, 3);
    expect(out.length).toBeGreaterThan(0);
    const hit = out.find((o) => o.mod.id === first.id);
    expect(hit?.status).toBe("hoan-thanh");
    expect(hit?.score).toBeGreaterThan(0);
  });

  it("query rỗng → mảng rỗng", () => {
    expect(findRelevantModulesForQuery(modules, "   ", {})).toHaveLength(0);
  });

  it("module không trong progress → status mặc định chua-hoc", () => {
    const first = modules[0]!;
    const out = findRelevantModulesForQuery(modules, first.title, {});
    const hit = out.find((o) => o.mod.id === first.id);
    expect(hit?.status).toBe("chua-hoc");
  });
});
