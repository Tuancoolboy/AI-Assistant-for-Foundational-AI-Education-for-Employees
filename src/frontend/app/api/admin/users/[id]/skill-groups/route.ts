// POST /api/admin/users/[id]/skill-groups
// Admin gán nhóm kỹ năng cho học viên. Cross-role được phép (admin override).
// Upsert user_skill_groups + populate roadmap cho mỗi slug.

import { requirePlatformAdminContext } from "@/lib/platform-admin-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logUserActivity } from "@/lib/audit-log";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requirePlatformAdminContext();
  if (!admin) return apiError("FORBIDDEN", "Chỉ platform admin mới được thực hiện thao tác này.");

  const { id: targetUserId } = await params;
  if (!targetUserId) return apiError("VALIDATION_ERROR", "Thiếu user id.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body không hợp lệ.");
  }

  const { skill_slugs } = body as { skill_slugs?: unknown };
  if (!Array.isArray(skill_slugs) || skill_slugs.length === 0) {
    return apiError("VALIDATION_ERROR", "skill_slugs phải là mảng không rỗng.");
  }
  if (!skill_slugs.every((s) => typeof s === "string")) {
    return apiError("VALIDATION_ERROR", "Tất cả skill_slugs phải là chuỗi.");
  }
  const slugs = skill_slugs as string[];

  if (!isSupabaseConfigured()) {
    // Demo mode: giả lập thành công
    return apiOk({ assigned: slugs, roadmapCount: 0 });
  }

  const service = createSupabaseServiceClient();

  // Kiểm tra slugs tồn tại và active
  const { data: validGroups, error: groupErr } = await service
    .from("skill_groups")
    .select("slug")
    .in("slug", slugs)
    .eq("is_active", true);
  if (groupErr) return apiError("INTERNAL_ERROR", `Lỗi kiểm tra nhóm: ${groupErr.message}`);

  const validSlugs = new Set((validGroups ?? []).map((g: { slug: string }) => g.slug));
  const invalidSlugs = slugs.filter((s) => !validSlugs.has(s));
  if (invalidSlugs.length > 0) {
    return apiError(
      "VALIDATION_ERROR",
      `Nhóm không tồn tại hoặc không hoạt động: ${invalidSlugs.join(", ")}`,
    );
  }

  // Upsert user_skill_groups: source='admin', assigned_by=adminUserId, is_active=true
  const adminUserId = admin.userId;
  const upsertRows = slugs.map((slug) => ({
    user_id: targetUserId,
    skill_slug: slug,
    source: "admin" as const,
    assigned_by: adminUserId === "demo-user" ? null : adminUserId,
    is_active: true,
    assigned_at: new Date().toISOString(),
  }));

  const { error: upsertErr } = await service
    .from("user_skill_groups")
    .upsert(upsertRows, { onConflict: "user_id,skill_slug" });
  if (upsertErr) return apiError("INTERNAL_ERROR", `Lỗi gán nhóm: ${upsertErr.message}`);

  // Populate roadmap cho mỗi slug
  let roadmapCount = 0;
  for (const slug of slugs) {
    const { data, error: rpcErr } = await service.rpc("populate_roadmap_for_group", {
      p_user: targetUserId,
      p_slug: slug,
      p_source: "admin",
    });
    if (rpcErr) {
      console.error(`[admin/skill-groups] populate_roadmap_for_group(${slug}):`, rpcErr.message);
    } else {
      roadmapCount += (data as number) ?? 0;
    }
  }

  await logUserActivity(adminUserId, "roadmap.skill_groups_admin", {
    targetUser: targetUserId,
    slugs,
    roadmapCount,
  });

  return apiOk({ assigned: slugs, roadmapCount });
}
