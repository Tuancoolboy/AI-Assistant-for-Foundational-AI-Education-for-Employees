import type { LearningModuleRecord } from "@/lib/learning-modules-data";
import type { RoleId } from "@/lib/openai";
import type { ExtraSkillLessonCatalogItem } from "@/lib/extra-skill-lessons";

// Quyết định gating cho employee chat (xem specs/BE-14):
//  - answered-learned: bài đã học mà hỏi lại → cho đáp án + giọng cà khịa theo cấp.
//  - must-learn: bài có trong kho nhưng chưa học → định hướng học, không cho đáp án.
//  - no-lesson: không có bài phù hợp → trả lời khéo + auto-capture skill gap.
export type SkillGatingCase = "answered-learned" | "must-learn" | "no-lesson";

export type LessonStatus = "chua-hoc" | "dang-hoc" | "hoan-thanh";

export type SkillGatingLessonOption = {
  moduleId: string;
  title: string;
  href: string; // /lo-trinh/<id> (hoặc ?extra=1 cho Kỹ năng khác)
  status: LessonStatus;
  source: "curriculum" | "extra-skill";
  skillSlug: string | null;
  summary: string;
};

export type EmotionLevel = 0 | 1 | 2 | 3;

export type SkillGatingResult = {
  decision: SkillGatingCase;
  skillKey: string | null; // skill_slug ?? moduleId ?? null
  primary: SkillGatingLessonOption | null;
  options: SkillGatingLessonOption[]; // tối đa 3, dùng cho case B
  reaskCount: number; // counter sau khi +1 cho lượt này (chỉ case A)
  emotionLevel: EmotionLevel; // map từ reaskCount
  bestMatchScore: number; // điểm khớp cao nhất (để biết "gần" cỡ nào khi miss)
};

export type SkillGatingInput = {
  roleId: RoleId;
  message: string;
  relevantModules: Array<{
    mod: LearningModuleRecord;
    score: number;
    status: string;
  }>;
  extraSkillMatch: ExtraSkillLessonCatalogItem | null;
  // Trạng thái học để suy ra status cho bài "Kỹ năng khác" (curriculum đã có sẵn status).
  progressByModuleId: Record<string, string>;
  priorReaskCount: number; // đọc từ bảng counter trước đó, 0 nếu chưa có
};

// Ngưỡng "có bài phù hợp". Nâng nhẹ so với `> 0` của curriculum để tránh khớp rác
// → rơi nhầm vào case A/B. Extra-skill match coi như đạt ngưỡng riêng (đã được lọc
// kỹ trong findExtraSkillLessonForQuery). Xem specs/notes BE-14 phần tradeoff.
export const GATING_MIN_SCORE = 2;

// Điểm gán cho extra-skill match khi đưa vào ranking chung. Đặt = ngưỡng để curriculum
// có điểm cao hơn vẫn được ưu tiên làm primary, nhưng extra một mình vẫn vượt ngưỡng.
const EXTRA_SKILL_BASE_SCORE = GATING_MIN_SCORE;

const VALID_STATUS = new Set<LessonStatus>(["chua-hoc", "dang-hoc", "hoan-thanh"]);

function normalizeStatus(raw: string | undefined): LessonStatus {
  return raw && VALID_STATUS.has(raw as LessonStatus)
    ? (raw as LessonStatus)
    : "chua-hoc";
}

export function mapEmotion(reaskCount: number): EmotionLevel {
  if (reaskCount <= 1) return 0;
  if (reaskCount === 2) return 1;
  if (reaskCount === 3) return 2;
  return 3;
}

// Gom ứng viên bài học từ 2 nguồn, đã lọc ngưỡng + sắp theo score giảm dần, tối đa 3.
// Pure: không gọi DB. Dùng lại cho cả resolveSkillGating và route (lấy skillKey trước
// khi load counter).
export function collectGatingCandidates(
  input: Pick<
    SkillGatingInput,
    "relevantModules" | "extraSkillMatch" | "progressByModuleId"
  >,
): SkillGatingLessonOption[] {
  const candidates: Array<{ option: SkillGatingLessonOption; score: number }> = [];

  for (const item of input.relevantModules) {
    if (item.score < GATING_MIN_SCORE) continue;
    candidates.push({
      score: item.score,
      option: {
        moduleId: item.mod.id,
        title: item.mod.title,
        href: `/lo-trinh/${item.mod.id}`,
        status: normalizeStatus(item.status),
        source: "curriculum",
        skillSlug: null,
        summary: item.mod.summary,
      },
    });
  }

  if (input.extraSkillMatch) {
    const item = input.extraSkillMatch;
    // Tránh trùng nếu bài extra đã xuất hiện trong curriculum.
    if (!candidates.some((c) => c.option.moduleId === item.moduleId)) {
      candidates.push({
        score: EXTRA_SKILL_BASE_SCORE,
        option: {
          moduleId: item.moduleId,
          title: item.title,
          href: `/lo-trinh/${item.moduleId}?extra=1`,
          status: normalizeStatus(input.progressByModuleId[item.moduleId]),
          source: "extra-skill",
          skillSlug: item.skillSlug,
          summary: item.summary,
        },
      });
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.option);
}

function bestScore(input: SkillGatingInput): number {
  let best = 0;
  for (const item of input.relevantModules) {
    if (item.score > best) best = item.score;
  }
  if (input.extraSkillMatch) best = Math.max(best, EXTRA_SKILL_BASE_SCORE);
  return best;
}

export function resolveSkillGating(input: SkillGatingInput): SkillGatingResult {
  const options = collectGatingCandidates(input);
  const primary = options[0] ?? null;
  const matchScore = bestScore(input);

  if (!primary) {
    return {
      decision: "no-lesson",
      skillKey: null,
      primary: null,
      options: [],
      reaskCount: 0,
      emotionLevel: 0,
      bestMatchScore: matchScore,
    };
  }

  const skillKey = primary.skillSlug ?? primary.moduleId;

  if (primary.status === "hoan-thanh") {
    const reaskCount = input.priorReaskCount + 1;
    return {
      decision: "answered-learned",
      skillKey,
      primary,
      options,
      reaskCount,
      emotionLevel: mapEmotion(reaskCount),
      bestMatchScore: matchScore,
    };
  }

  return {
    decision: "must-learn",
    skillKey,
    primary,
    options,
    reaskCount: 0,
    emotionLevel: 0,
    bestMatchScore: matchScore,
  };
}
