import { describe, expect, it } from "vitest";
import {
  extractGeneratedLearningPathModuleIds,
  resolveSuggestedModuleIds,
} from "./learning-path-selection";

describe("extractGeneratedLearningPathModuleIds", () => {
  it("ưu tiên orderedModuleIds khi có sẵn", () => {
    expect(
      extractGeneratedLearningPathModuleIds({
        orderedModuleIds: ["a", "b", "c"],
        groups: [{ moduleIds: ["x", "y"] }],
      }),
    ).toEqual(["a", "b", "c"]);
  });

  it("fallback sang groups.moduleIds khi orderedModuleIds không còn", () => {
    expect(
      extractGeneratedLearningPathModuleIds({
        groups: [
          { moduleIds: ["a", "b", "a"] },
          { moduleIds: ["c", 1, null, "d"] },
        ],
      }),
    ).toEqual(["a", "b", "c", "d"]);
  });
});

describe("resolveSuggestedModuleIds", () => {
  it("lọc theo role từ result.groups khi không có orderedModuleIds", () => {
    expect(
      resolveSuggestedModuleIds(
        "nhan-su",
        {
          groups: [
            { moduleIds: ["nhan-su-m1", "marketing-m2", "nhan-su-m3"] },
          ],
        },
        1,
      ),
    ).toEqual(["nhan-su-m1", "nhan-su-m3"]);
  });
});
