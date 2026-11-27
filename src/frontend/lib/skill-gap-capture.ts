import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getUserOrganizationMembership } from "@/lib/organizations";
import { sanitizePromptContextText } from "@/lib/chat-prompt-safety";
import type { RoleId } from "@/lib/openai";

// Auto-capture skill gap (CASE C + near-miss): KHÔNG được mất câu hỏi nào dù user
// không tương tác gì. Ghi bằng service role, fail-open. Xem specs/BE-14 §4.3.

// Gom các cách hỏi gần giống về cùng cluster: bỏ dấu, giữ token chính (>=3 ký tự),
// sort để thứ tự từ không ảnh hưởng. Ghép role_id để tách theo vai trò.
export function buildClusterKey(question: string, roleId: string | null): string {
  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const tokens = Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3),
    ),
  ).sort();
  const base = tokens.slice(0, 12).join(" ") || normalized.trim().slice(0, 60);
  return `${base}:${roleId ?? "khac"}`;
}

export async function resolveUserOrganizationId(
  userId: string,
): Promise<string | null> {
  try {
    const supabase = createSupabaseServiceClient();
    const membership = await getUserOrganizationMembership(supabase, userId);
    return membership?.organization_id ?? null;
  } catch (err) {
    console.error("[skill-gap-capture:org]", err);
    return null;
  }
}

export type CaptureSkillGapInput = {
  userId: string;
  organizationId: string | null;
  roleId: RoleId | null;
  question: string;
  bestMatchScore: number;
  suggestedSkillSlug: string | null;
};

// Trả về skillGapId để gắn vào unsolved_questions / cập nhật ai_attempt sau stream.
export async function captureSkillGap(
  input: CaptureSkillGapInput,
): Promise<{ skillGapId: string } | null> {
  try {
    const cleanQuestion = sanitizePromptContextText(input.question, 1000);
    if (!cleanQuestion.trim()) return null;
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("capture_skill_gap", {
      p_organization_id: input.organizationId,
      p_role_id: input.roleId,
      p_cluster_key: buildClusterKey(cleanQuestion, input.roleId),
      p_question: cleanQuestion,
      p_match_score: input.bestMatchScore,
      p_suggested_skill_slug: input.suggestedSkillSlug,
      p_user_id: input.userId,
    });
    if (error) {
      console.error("[skill-gap-capture]", error.message);
      return null;
    }
    return typeof data === "string" ? { skillGapId: data } : null;
  } catch (err) {
    console.error("[skill-gap-capture]", err);
    return null;
  }
}

// Cập nhật câu trả lời khéo léo AI đã đưa (tham khảo cho người curate), sau khi stream xong.
export async function updateSkillGapAiAttempt(
  skillGapId: string,
  aiAttempt: string,
): Promise<void> {
  try {
    const clean = sanitizePromptContextText(aiAttempt, 1000);
    if (!clean.trim()) return;
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("skill_gaps")
      .update({ ai_attempt: clean })
      .eq("id", skillGapId)
      .is("ai_attempt", null);
    if (error) console.error("[skill-gap-capture:ai-attempt]", error.message);
  } catch (err) {
    console.error("[skill-gap-capture:ai-attempt]", err);
  }
}
