// PATCH /api/member/roadmap/toggle — check/uncheck 1 bài (flip is_selected).
// Defense-in-depth ngoài RLS: 404 bài lạ, 403 bài ngoài nhóm sở hữu.
// Trả groupPercent/totalPercent tính LẠI từ DB (không tin client).

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { recomputePercent, userOwnsGroup } from "@/lib/roadmap-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "API lộ trình cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }

  let body: { moduleId?: unknown; isSelected?: unknown };
  try {
    body = (await request.json()) as { moduleId?: unknown; isSelected?: unknown };
  } catch {
    return apiError("VALIDATION_ERROR", "JSON không hợp lệ.");
  }
  const moduleId = body.moduleId;
  const isSelected = body.isSelected;
  if (typeof moduleId !== "string" || moduleId.length === 0) {
    return apiError("VALIDATION_ERROR", "Thiếu moduleId.");
  }
  if (typeof isSelected !== "boolean") {
    return apiError("VALIDATION_ERROR", "isSelected phải là true/false.");
  }

  const supabase = await createSupabaseServerClient();
  try {
    // Bài phải tồn tại trong learning_modules + có nhóm.
    const { data: mod, error: modErr } = await supabase
      .from("learning_modules")
      .select("id, skill_slug")
      .eq("id", moduleId)
      .maybeSingle<{ id: string; skill_slug: string | null }>();
    if (modErr) throw new Error(modErr.message);
    if (!mod) {
      return apiError("NOT_FOUND", "Bài học không tồn tại.");
    }

    const owned = await userOwnsGroup(supabase, session.userId, mod.skill_slug);
    if (!owned) {
      return apiError("FORBIDDEN", "Bài ngoài nhóm kỹ năng của bạn.");
    }

    // Chỉ đổi is_selected (trigger DB chặn đổi cột khác). RLS chặn lần 2.
    const { error: upErr } = await supabase
      .from("user_roadmap")
      .update({ is_selected: isSelected })
      .eq("user_id", session.userId)
      .eq("module_id", moduleId);
    if (upErr) throw new Error(upErr.message);

    const pct = await recomputePercent(
      supabase,
      session.userId,
      mod.skill_slug as string,
    );
    return apiOk({
      moduleId,
      isSelected,
      groupPercent: pct.group,
      totalPercent: pct.total,
    });
  } catch (err) {
    console.error("[member:roadmap:toggle]", (err as Error).message);
    return apiError("INTERNAL_ERROR", "Không lưu được thay đổi.");
  }
}
