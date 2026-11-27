// Taxonomy cấp độ DUY NHẤT cho LMS roadmap opt-out: 4 cấp hiển thị.
// DB giữ level 1..5 (tương thích sync EM), nhưng tầng đọc gộp level >= 4 → Master.
// Tách khỏi `learning-tiers.ts` (5 tier, chia đôi level 2) để badge /lo-trinh không lệch.

export const LMS_LEVELS = [
  { level: 1, label: "Cơ bản" },
  { level: 2, label: "Nâng cao" },
  { level: 3, label: "Nâng trình" },
  { level: 4, label: "Master" }, // level 5 cũng map về đây
] as const;

export type LmsLevel = 1 | 2 | 3 | 4;

/** Map level DB (1..5) → 1 trong 4 cấp hiển thị. level >= 4 (gồm 5) → Master(4). */
export function toLmsLevel(dbLevel: number): LmsLevel {
  if (dbLevel >= 4) return 4;
  if (dbLevel <= 1) return 1;
  return dbLevel as LmsLevel;
}

/** Nhãn tiếng Việt của 1 cấp LMS. */
export function lmsLevelLabel(level: LmsLevel): string {
  return LMS_LEVELS.find((l) => l.level === level)?.label ?? `Cấp ${level}`;
}
