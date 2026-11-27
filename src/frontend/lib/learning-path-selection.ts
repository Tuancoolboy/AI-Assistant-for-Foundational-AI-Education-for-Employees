// Logic chọn bài cho bước composition (FE-15 §7-8). Thuần, không phụ thuộc DB.
// "Lộ trình gợi ý" ưu tiên lấy từ generated_learning_paths.result.orderedModuleIds,
// nhưng nếu shape mới chỉ còn groups thì ghép từ groups.moduleIds. Chỉ giữ các bài
// thuộc đúng vai trò người học (tránh kéo bài chéo vai trò vào màn 4 tier).
// Fail-safe: nếu không có gợi ý hợp lệ → mặc định gợi ý = bài của vai trò theo aiLevel.

import { getModulesForUser, getRole } from "@/lib/roles";
import { selectPathModuleIds } from "@/lib/path-selection";

export type SuggestionSurveyResult = {
  dailyTasks?: string[];
  skipBasicModules?: boolean;
  aiLevel?: number;
};

// Không giới hạn số bài được chọn (đặt cao hơn tổng số bài để không chặn thực tế).
export const MAX_SELECTION = 999;

export function roleModuleIds(roleId: string): string[] {
  return getRole(roleId)?.modules.map((m) => m.id) ?? [];
}

// Một bài thuộc vai trò khi id theo quy ước `${roleId}-m{n}`. Dùng prefix thay vì so với
// danh sách static (roles-hr.ts) vì kho bài thật trong DB (sync từ Notion) có thể nhiều hơn
// static — không được rớt các bài mới (vd nhan-su m57–m64) khỏi lộ trình gợi ý/đã chọn.
export function belongsToRole(roleId: string, id: string): boolean {
  return id.startsWith(`${roleId}-`);
}

export type GeneratedLearningPathResultLike = {
  orderedModuleIds?: unknown;
  groups?: unknown;
};

function flattenGroupModuleIds(groups: unknown): string[] {
  if (!Array.isArray(groups)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const moduleIds = Array.isArray((group as { moduleIds?: unknown }).moduleIds)
      ? ((group as { moduleIds?: unknown[] }).moduleIds ?? [])
      : [];
    for (const rawId of moduleIds) {
      if (typeof rawId !== "string") continue;
      const id = rawId.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function extractGeneratedLearningPathModuleIds(
  result: GeneratedLearningPathResultLike | null | undefined,
): string[] {
  if (!result) return [];
  if (Array.isArray(result.orderedModuleIds)) {
    return result.orderedModuleIds.filter((id): id is string => typeof id === "string");
  }
  return flattenGroupModuleIds(result.groups);
}

// ID bài gợi ý. Ưu tiên phân bổ theo PHẦN đã chọn ở khảo sát (rule-based, nguồn
// sự thật — khớp với số bài thông báo ở màn kết quả onboarding). Chưa chọn phần
// nào → giữ logic cũ (path đã sinh / toàn bộ bài theo level).
export function resolveSuggestedModuleIds(
  roleId: string,
  pathResult: GeneratedLearningPathResultLike | string[],
  aiLevel: number,
  survey?: SuggestionSurveyResult | null,
): string[] {
  if ((survey?.dailyTasks?.length ?? 0) > 0) {
    const surveyIds = selectPathModuleIds(roleId, survey);
    if (surveyIds.length > 0) return surveyIds;
  }

  const orderedModuleIds = Array.isArray(pathResult)
    ? pathResult
    : extractGeneratedLearningPathModuleIds(pathResult);
  const intersection = orderedModuleIds.filter((id) => belongsToRole(roleId, id));
  if (intersection.length > 0) return intersection;
  return getModulesForUser(roleId, aiLevel).map((m) => m.id);
}

// Lọc + khử trùng danh sách bài người dùng gửi lên, chỉ giữ bài hợp lệ của vai trò.
export function sanitizeSelection(roleId: string, ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!belongsToRole(roleId, id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
