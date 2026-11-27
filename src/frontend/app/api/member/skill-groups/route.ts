// GET  /api/member/skill-groups — các nhóm user được học (nguồn locked-scope).
// POST /api/member/skill-groups — (Onboarding) chọn nhóm mục tiêu → auto-populate.
//   RLS không cấp INSERT user_skill_groups cho user → POST chạy service-role,
//   validate CHẶT: skill_slugs ∈ skill_groups WHERE role_id = profile.role_id.

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { logUserActivity } from "@/lib/audit-log";
import { getOwnedGroups } from "@/lib/roadmap-service";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "API lộ trình cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }
  const supabase = await createSupabaseServerClient();
  try {
    const groups = await getOwnedGroups(supabase, session.userId);
    return apiOk({ groups: groups.map((g) => ({ slug: g.slug, label: g.label })) });
  } catch (err) {
    console.error("[member:skill-groups:get]", (err as Error).message);
    return apiError("INTERNAL_ERROR", "Không đọc được nhóm kỹ năng.");
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "API lộ trình cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }

  let body: { skill_slugs?: unknown };
  try {
    body = (await request.json()) as { skill_slugs?: unknown };
  } catch {
    return apiError("VALIDATION_ERROR", "JSON không hợp lệ.");
  }
  const slugs = Array.isArray(body.skill_slugs)
    ? [...new Set(body.skill_slugs.filter((s): s is string => typeof s === "string"))]
    : [];
  if (slugs.length === 0) {
    return apiError("VALIDATION_ERROR", "Hãy chọn ít nhất 1 nhóm kỹ năng.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role_id")
    .eq("id", session.userId)
    .maybeSingle<{ role_id: string | null }>();
  if (pErr) {
    console.error("[member:skill-groups:post:profile]", pErr.message);
    return apiError("INTERNAL_ERROR", "Không đọc được hồ sơ.");
  }
  const roleId = profile?.role_id ?? null;
  if (!roleId) {
    return apiError("VALIDATION_ERROR", "Chưa chọn vai trò.");
  }

  // Validate slug đúng vai trò user (chặn gán nhóm chéo vai trò).
  const service = createSupabaseServiceClient();
  const { data: validGroups, error: gErr } = await service
    .from("skill_groups")
    .select("slug")
    .eq("role_id", roleId)
    .eq("is_active", true)
    .in("slug", slugs);
  if (gErr) {
    console.error("[member:skill-groups:post:validate]", gErr.message);
    return apiError("INTERNAL_ERROR", "Không kiểm tra được nhóm kỹ năng.");
  }
  const allowed = (validGroups ?? []).map((g) => (g as { slug: string }).slug);
  if (allowed.length === 0) {
    return apiError("VALIDATION_ERROR", "Nhóm kỹ năng không hợp lệ với vai trò.");
  }

  // Upsert user_skill_groups (source onboarding) + populate trọn bộ bài mỗi nhóm.
  const rows = allowed.map((slug) => ({
    user_id: session.userId,
    skill_slug: slug,
    source: "onboarding" as const,
    is_active: true,
  }));
  const { error: insErr } = await service
    .from("user_skill_groups")
    .upsert(rows, { onConflict: "user_id,skill_slug" });
  if (insErr) {
    console.error("[member:skill-groups:post:upsert]", insErr.message);
    return apiError("INTERNAL_ERROR", "Không lưu được nhóm kỹ năng.");
  }

  let roadmapCount = 0;
  for (const slug of allowed) {
    const { data: added, error: rpcErr } = await service.rpc(
      "populate_roadmap_for_group",
      { p_user: session.userId, p_slug: slug, p_source: "onboarding" },
    );
    if (rpcErr) {
      console.error("[member:skill-groups:post:populate]", rpcErr.message);
      return apiError("INTERNAL_ERROR", "Không tạo được lộ trình.");
    }
    roadmapCount += typeof added === "number" ? added : 0;
  }

  void logUserActivity(session.userId, "roadmap.skill_groups_select", {
    skillSlugs: allowed,
    roadmapCount,
  });

  return apiOk({
    groups: allowed.map((slug) => ({ slug })),
    roadmapCount,
  });
}
