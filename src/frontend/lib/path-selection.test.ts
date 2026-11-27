import { describe, expect, it } from "vitest";
import { selectPathModuleIds } from "./path-selection";
import { getRole, type RoleModule } from "./roles";
import { HR_TASK_CATEGORIES } from "./roles-hr";

const HR = "nhan-su";

function hrModules(): RoleModule[] {
  return getRole(HR)!.modules;
}
function byId(id: string): RoleModule | undefined {
  return hrModules().find((m) => m.id === id);
}

describe("selectPathModuleIds — phân bổ bài theo khảo sát (HR)", () => {
  it("chọn 1 nhóm việc → chỉ ra bài của đúng nhóm đó (+ nền tảng)", () => {
    const slug = "hr-tuyen-dung";
    const ids = selectPathModuleIds(HR, { dailyTasks: [slug], aiLevel: 1 });

    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const m = byId(id)!;
      const ok = m.isFoundation || (m.skills ?? []).includes(slug);
      expect(ok, `bài ${id} không thuộc nền tảng và không có skill ${slug}`).toBe(
        true,
      );
    }
    // Có ít nhất 1 bài chuyên môn của nhóm đã chọn.
    expect(ids.some((id) => (byId(id)!.skills ?? []).includes(slug))).toBe(true);
  });

  it("chọn nhiều nhóm khác nhau → số bài khác nhau (phân bổ động)", () => {
    const a = selectPathModuleIds(HR, {
      dailyTasks: ["hr-tuyen-dung"],
      aiLevel: 1,
    });
    const big = selectPathModuleIds(HR, {
      dailyTasks: HR_TASK_CATEGORIES.map((c) => c.slug),
      aiLevel: 1,
    });
    expect(big.length).toBeGreaterThan(a.length);
  });

  it("không chọn nhóm nào → fallback toàn bộ bài vai trò", () => {
    const ids = selectPathModuleIds(HR, { dailyTasks: [], aiLevel: 1 });
    expect(ids.length).toBe(hrModules().length);
  });

  it("đã giỏi (aiLevel ≥ 5) → bỏ bài cơ bản (level 1)", () => {
    const ids = selectPathModuleIds(HR, {
      dailyTasks: HR_TASK_CATEGORIES.map((c) => c.slug),
      aiLevel: 5,
    });
    for (const id of ids) {
      expect(byId(id)!.level).toBeGreaterThanOrEqual(2);
    }
  });

  it("deterministic + đồng nhất 2 màn: cùng input → cùng output", () => {
    const input = { dailyTasks: ["hr-cb-luong", "hr-hieu-suat"], aiLevel: 2 };
    const onboardingCount = selectPathModuleIds(HR, input);
    const loTrinhCount = selectPathModuleIds(HR, input);
    expect(loTrinhCount).toEqual(onboardingCount);
  });

  it("vai trò không tồn tại / không có khảo sát → mảng rỗng an toàn", () => {
    expect(selectPathModuleIds("khong-co", { dailyTasks: ["x"] })).toEqual([]);
    expect(selectPathModuleIds(null, null)).toEqual([]);
  });
});
