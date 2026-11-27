const HCM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type LearningMetricsDateRange = {
  fromMs: number | null;
  toExclusiveMs: number | null;
};

function hcmStartOfDayMs(value: string): number | null {
  const match = DATE_INPUT_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const check = new Date(utcMidnight);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return utcMidnight - HCM_UTC_OFFSET_MS;
}

export function parseLearningMetricsDateRange(
  fromDate: string | null,
  toDate: string | null,
): LearningMetricsDateRange | null {
  const fromMs = fromDate ? hcmStartOfDayMs(fromDate) : null;
  const toStartMs = toDate ? hcmStartOfDayMs(toDate) : null;
  if ((fromDate && fromMs === null) || (toDate && toStartMs === null)) return null;

  const toExclusiveMs =
    toStartMs === null ? null : toStartMs + 24 * 60 * 60 * 1000;
  if (fromMs !== null && toExclusiveMs !== null && fromMs >= toExclusiveMs) {
    return null;
  }

  return { fromMs, toExclusiveMs };
}

export function isTimestampInLearningMetricsRange(
  value: string | null | undefined,
  range: LearningMetricsDateRange,
): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  if (range.fromMs !== null && timestamp < range.fromMs) return false;
  if (range.toExclusiveMs !== null && timestamp >= range.toExclusiveMs) return false;
  return true;
}

