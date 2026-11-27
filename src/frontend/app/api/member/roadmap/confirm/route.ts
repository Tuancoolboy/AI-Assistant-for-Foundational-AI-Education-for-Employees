// POST /api/member/roadmap/confirm  Body: { unselectedModuleIds: string[] }
// Reconcile is_selected toàn bộ + set learning_path_confirmed_at. Service-role.
import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return apiError("FORBIDDEN", "API lộ trình cần Supabase.");
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  let body: { unselectedModuleIds?: unknown };
  try { body = (await request.json()) as { unselectedModuleIds?: unknown }; } catch { return apiError("VALIDATION_ERROR", "JSON không hợp lệ."); }
  const unselectedModuleIds = Array.isArray(body.unselectedModuleIds) ? body.unselectedModuleIds.filter((x): x is string => typeof x === "string") : [];
  const service = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const { error: allTrueErr } = await service.from("user_roadmap").update({ is_selected: true, updated_at: now }).eq("user_id", session.userId);
  if (allTrueErr) { console.error("[roadmap:confirm:allTrue]", allTrueErr.message); return apiError("INTERNAL_ERROR", "Không cập nhật được lộ trình."); }
  if (unselectedModuleIds.length > 0) {
    const { error: falseErr } = await service.from("user_roadmap").update({ is_selected: false, updated_at: now }).eq("user_id", session.userId).in("module_id", unselectedModuleIds);
    if (falseErr) { console.error("[roadmap:confirm:setFalse]", falseErr.message); return apiError("INTERNAL_ERROR", "Không cập nhật được lộ trình."); }
  }
  const { error: profErr } = await service.from("profiles").update({ learning_path_confirmed_at: now }).eq("id", session.userId);
  if (profErr) { console.error("[roadmap:confirm:profile]", profErr.message); return apiError("INTERNAL_ERROR", "Không lưu được xác nhận lộ trình."); }
  return apiOk({ confirmed: true, unselectedCount: unselectedModuleIds.length });
}
