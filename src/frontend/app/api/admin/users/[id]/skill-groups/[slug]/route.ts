// DELETE /api/admin/users/[id]/skill-groups/[slug]
// Admin soft-delete nhóm kỹ năng của học viên (is_active=false).
// KHÔNG xóa user_roadmap — giữ lịch sử is_selected.

import { requirePlatformAdminContext } from "@/lib/platform-admin-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logUserActivity } from "@/lib/audit-log";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; slug: string }> },
) {
  const admin = await requirePlatformAdminContext();
  if (!admin) return apiError("FORBIDDEN", "Chỉ platform admin mới được thực hiện thao tác này.");

  const { id: targetUserId, slug } = await params;
  if (!targetUserId || !slug) return apiError("VALIDATION_ERROR", "Thiếu user id hoặc slug.");

  if (!isSupabaseConfigured()) {
    return apiOk({ removed: slug });
  }

  const service = createSupabaseServiceClient();

  // Soft-delete: chỉ tắt is_active, KHÔNG xóa dòng và KHÔNG xóa user_roadmap
  const { error } = await service
    .from("user_skill_groups")
    .update({ is_active: false })
    .eq("user_id", targetUserId)
    .eq("skill_slug", slug);

  if (error) return apiError("INTERNAL_ERROR", `Lỗi gỡ nhóm: ${error.message}`);

  await logUserActivity(admin.userId, "roadmap.skill_groups_admin", {
    action: "remove",
    targetUser: targetUserId,
    slug,
  });

  return apiOk({ removed: slug });
}
