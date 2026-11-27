import { describe, expect, it } from "vitest";
import {
  isTimestampInLearningMetricsRange,
  parseLearningMetricsDateRange,
} from "./learning-metrics-date-range";

describe("learning metrics date range", () => {
  it("converts one Vietnam calendar day to an exclusive UTC range", () => {
    const range = parseLearningMetricsDateRange("2026-06-24", "2026-06-24");

    expect(range).toEqual({
      fromMs: Date.parse("2026-06-23T17:00:00.000Z"),
      toExclusiveMs: Date.parse("2026-06-24T17:00:00.000Z"),
    });
  });

  it("includes the entire selected day and excludes the next day", () => {
    const range = parseLearningMetricsDateRange("2026-06-24", "2026-06-24");
    expect(range).not.toBeNull();

    expect(
      isTimestampInLearningMetricsRange("2026-06-23T17:00:00.000Z", range!),
    ).toBe(true);
    expect(
      isTimestampInLearningMetricsRange("2026-06-24T16:59:59.999Z", range!),
    ).toBe(true);
    expect(
      isTimestampInLearningMetricsRange("2026-06-24T17:00:00.000Z", range!),
    ).toBe(false);
  });

  it("rejects invalid and reversed date ranges", () => {
    expect(parseLearningMetricsDateRange("2026-02-30", null)).toBeNull();
    expect(
      parseLearningMetricsDateRange("2026-06-25", "2026-06-24"),
    ).toBeNull();
  });
});
