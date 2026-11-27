// POST /api/admin/skill-groups/[slug]/resync
// Admin resync: chèn bài mới (published) của nhóm vào user_roadmap cho tất cả
// user đang active trong nhóm. Bài mới chèn với is_selected=false (opt-in retro)
// để không phá % của học viên đã đạt gần 100%.
// KHÔNG dùng RPC populate (nó mặc định is_selected=true).

import { requirePlatformAdminContext } from "@/lib/platform-admin-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requirePlatformAdminContext();
  if (!admin) return apiError("FORBIDDEN", "Chỉ platform admin mới được thực hiện thao tác này.");

  const { slug } = await params;
  if (!slug) return apiError("VALIDATION_ERROR", "Thiếu slug nhóm.");

  if (!isSupabaseConfigured()) {
    return apiOk({ usersUpdated: 0, modulesAdded: 0 });
  }

  const service = createSupabaseServiceClient();

  // 1. Lấy danh sách module published của nhóm này
  const { data: modules, error: modErr } = await service
    .from("learning_modules")
    .select("id")
    .eq("skill_slug", slug)
    .eq("published", true);
  if (modErr) return apiError("INTERNAL_ERROR", `Lỗi đọc learning_modules: ${modErr.message}`);

  const allModuleIds = (modules ?? []).map((m: { id: string }) => m.id);
  if (allModuleIds.length === 0) {
    return apiOk({ usersUpdated: 0, modulesAdded: 0 });
  }

  // 2. Lấy danh sách user active trong nhóm
  const { data: activeUsers, error: userErr } = await service
    .from("user_skill_groups")
    .select("user_id")
    .eq("skill_slug", slug)
    .eq("is_active", true);
  if (userErr) return apiError("INTERNAL_ERROR", `Lỗi đọc user_skill_groups: ${userErr.message}`);

  const userIds = [...new Set((activeUsers ?? []).map((r: { user_id: string }) => r.user_id))];
  if (userIds.length === 0) {
    return apiOk({ usersUpdated: 0, modulesAdded: 0 });
  }

  // 3. Xử lý từng user: chèn bài còn thiếu với is_selected=false
  let usersUpdated = 0;
  let modulesAdded = 0;

  for (const userId of userIds) {
    // Lấy module_id đã có trong user_roadmap cho nhóm này
    const { data: existing, error: exErr } = await service
      .from("user_roadmap")
      .select("module_id")
      .eq("user_id", userId)
      .eq("skill_slug", slug);
    if (exErr) {
      console.error(`[resync] đọc user_roadmap user=${userId}:`, exErr.message);
      continue;
    }

    const existingIds = new Set((existing ?? []).map((r: { module_id: string }) => r.module_id));
    const missingIds = allModuleIds.filter((mid) => !existingIds.has(mid));
    if (missingIds.length === 0) continue;

    // Chèn bài thiếu với is_selected=false (opt-in retro — không tụt % cũ)
    const rows = missingIds.map((moduleId) => ({
      user_id: userId,
      module_id: moduleId,
      skill_slug: slug,
      is_selected: false,
      source: "admin",
    }));

    const { error: insertErr } = await service
      .from("user_roadmap")
      .insert(rows);
    if (insertErr) {
      console.error(`[resync] chèn user_roadmap user=${userId}:`, insertErr.message);
      continue;
    }

    usersUpdated++;
    modulesAdded += missingIds.length;
  }

  console.log(`[resync] slug=${slug} usersUpdated=${usersUpdated} modulesAdded=${modulesAdded}`);
  return apiOk({ usersUpdated, modulesAdded });
}
