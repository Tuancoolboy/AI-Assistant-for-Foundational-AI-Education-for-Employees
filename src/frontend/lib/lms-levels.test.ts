import { describe, expect, it } from "vitest";
import { LMS_LEVELS, lmsLevelLabel, toLmsLevel } from "./lms-levels";

describe("lms-levels — taxonomy 4 cấp", () => {
  it("có đúng 4 cấp hiển thị", () => {
    expect(LMS_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4]);
  });

  it("toLmsLevel giữ nguyên level 1..3", () => {
    expect(toLmsLevel(1)).toBe(1);
    expect(toLmsLevel(2)).toBe(2);
    expect(toLmsLevel(3)).toBe(3);
  });

  it("gộp level 4 và 5 → Master(4)", () => {
    expect(toLmsLevel(4)).toBe(4);
    expect(toLmsLevel(5)).toBe(4);
  });

  it("clamp level <= 0 về 1 (an toàn dữ liệu lỗi)", () => {
    expect(toLmsLevel(0)).toBe(1);
    expect(toLmsLevel(-3)).toBe(1);
  });

  it("lmsLevelLabel trả nhãn đúng", () => {
    expect(lmsLevelLabel(1)).toBe("Cơ bản");
    expect(lmsLevelLabel(4)).toBe("Master");
  });
});
