// Gỡ 1 skill khỏi bộ kỹ năng cá nhân (FE-16). RLS chỉ cho xoá skill của chính mình.

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import {
  canAccessLearning,
  loadLearningActivationRecord,
} from "@/lib/learning-activation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "API kỹ năng cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }
  const access = await loadLearningActivationRecord(session.userId);
  if (!canAccessLearning(access)) {
    return apiError("FORBIDDEN", "ACCOUNT_NOT_ACTIVATED");
  }

  const { skillId } = await params;
  if (!skillId) {
    return apiError("VALIDATION_ERROR", "Thiếu skillId.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_saved_skills")
    .delete()
    .eq("user_id", session.userId)
    .eq("skill_id", skillId);

  if (error) {
    console.error("[member-skills:delete]", error.message);
    return apiError("INTERNAL_ERROR", "Không gỡ được kỹ năng.");
  }

  return apiOk({ removed: true, skillId });
}
