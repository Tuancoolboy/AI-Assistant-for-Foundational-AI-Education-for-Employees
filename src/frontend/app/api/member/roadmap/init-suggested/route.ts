// POST /api/member/roadmap/init-suggested
// Seed lộ trình GỢI Ý theo KẾT QUẢ KHẢO SÁT (đúng số bài màn kết quả) — KHÔNG đổ trọn
// bộ kho. Dùng selectPathModuleIds giống màn onboarding. Idempotent + tự chữa (prune dư).
import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import type { AssessmentResult } from "@/lib/assessment";
import { selectPathModuleIds } from "@/lib/path-selection";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

type ProfileRow = { role_id: string | null; ai_level: number | null; daily_tasks: string[] | null; assessment_result: AssessmentResult | null; };

export async function POST() {
  if (!isSupabaseConfigured()) return apiError("FORBIDDEN", "API lộ trình cần Supabase.");
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  const supabase = await createSupabaseServerClient();
  const { data: profile, error: pErr } = await supabase.from("profiles")
    .select("role_id, ai_level, daily_tasks, assessment_result").eq("id", session.userId).maybeSingle<ProfileRow>();
  if (pErr) { console.error("[roadmap:init-suggested:profile]", pErr.message); return apiError("INTERNAL_ERROR", "Không đọc được hồ sơ."); }
  const roleId = profile?.role_id ?? null;
  if (!roleId) return apiError("VALIDATION_ERROR", "Chưa chọn vai trò.");
  const assessment = profile?.assessment_result ?? null;
  const survey = { dailyTasks: profile?.daily_tasks ?? assessment?.dailyTasks ?? [], skipBasicModules: assessment?.skipBasicModules, aiLevel: profile?.ai_level ?? assessment?.aiLevel ?? 0 };
  const suggestedIds = selectPathModuleIds(roleId, survey);
  if (suggestedIds.length === 0) return apiOk({ count: 0 });
  const service = createSupabaseServiceClient();
  const { data: mods, error: mErr } = await service.from("learning_modules").select("id, skill_slug, published").in("id", suggestedIds);
  if (mErr) { console.error("[roadmap:init-suggested:modules]", mErr.message); return apiError("INTERNAL_ERROR", "Không đọc được bài học."); }
  const usable = (mods ?? []).filter((m) => (m as { published?: boolean }).published !== false && (m as { skill_slug: string | null }).skill_slug) as { id: string; skill_slug: string }[];
  const slugs = [...new Set(usable.map((m) => m.skill_slug))];
  if (slugs.length > 0) {
    const groupRows = slugs.map((slug) => ({ user_id: session.userId, skill_slug: slug, source: "onboarding" as const, is_active: true }));
    const { error: gErr } = await service.from("user_skill_groups").upsert(groupRows, { onConflict: "user_id,skill_slug" });
    if (gErr) { console.error("[roadmap:init-suggested:groups]", gErr.message); return apiError("INTERNAL_ERROR", "Không gán được nhóm kỹ năng."); }
  }
  const roadmapRows = usable.map((m) => ({ user_id: session.userId, module_id: m.id, skill_slug: m.skill_slug, is_selected: true, source: "onboarding" as const }));
  const { error: rErr } = await service.from("user_roadmap").upsert(roadmapRows, { onConflict: "user_id,module_id", ignoreDuplicates: true });
  if (rErr) { console.error("[roadmap:init-suggested:roadmap]", rErr.message); return apiError("INTERNAL_ERROR", "Không tạo được lộ trình gợi ý."); }
  const keepIds = usable.map((m) => m.id);
  if (keepIds.length > 0) {
    await service.from("user_roadmap").delete().eq("user_id", session.userId).not("module_id", "in", `(${keepIds.join(",")})`);
    await service.from("user_skill_groups").delete().eq("user_id", session.userId).eq("source", "onboarding").not("skill_slug", "in", `(${slugs.join(",")})`);
  }
  return apiOk({ count: roadmapRows.length });
}
