// PATCH triage 1 skill_gap (manager/admin): đổi status, gán suggested_skill_slug, triaged_by.
// Xem specs/BE-14 §4.3(b). RLS update skill_gaps chỉ cho manager org.

import { apiError, apiOk } from "@/lib/api-error";
import { requireManagerContext } from "@/lib/manager-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

type PatchPayload = { status?: unknown; suggested_skill_slug?: unknown };

const VALID_STATUS = new Set([
  "new",
  "triaged",
  "in-progress",
  "dismissed",
  "duplicate",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "Tính năng cần Supabase.");
  }
  const ctx = await requireManagerContext();
  if (!ctx || ctx.session.mode !== "supabase") {
    return apiError("FORBIDDEN", "Chỉ quản lý mới thao tác được.");
  }
  const { id } = await params;

  let body: PatchPayload;
  try {
    body = (await request.json()) as PatchPayload;
  } catch {
    return apiError("VALIDATION_ERROR", "JSON không hợp lệ.");
  }

  const patch: Record<string, unknown> = { triaged_by: ctx.session.userId };
  if (typeof body.status === "string") {
    if (!VALID_STATUS.has(body.status)) {
      return apiError("VALIDATION_ERROR", "Trạng thái không hợp lệ.");
    }
    patch.status = body.status;
  }
  if (typeof body.suggested_skill_slug === "string") {
    patch.suggested_skill_slug = body.suggested_skill_slug.trim().slice(0, 80) || null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("skill_gaps")
      .update(patch)
      .eq("id", id)
      .select("id, status, suggested_skill_slug")
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError("NOT_FOUND", "Không tìm thấy hoặc không có quyền.");
    return apiOk({ gap: data });
  } catch (err) {
    console.error("[skill-gaps:patch]", err);
    return apiError("INTERNAL_ERROR", "Chưa cập nhật được.");
  }
}
