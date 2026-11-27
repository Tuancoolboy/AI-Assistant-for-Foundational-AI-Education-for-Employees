// Audit log (handoff §0.2): ghi hành động nhạy cảm vào bảng events (0005).
// Đổi quyền, mời/xóa thành viên, đổi tool, gán lộ trình → ghi 1 dòng sự kiện.
// Chưa cần dashboard giám sát; chỉ cần dữ liệu được ghi để sau bật lên.
// Dùng service role (server) để ghi cho đúng user_id, không phụ thuộc RLS insert.

export type AuditAction =
  | "org.ai_tool.update"
  | "department.ai_tool.update"
  | "member.invite"
  | "member.role.update"
  | "path.assign"
  | "platform_admin.action";

export type ActivityAction =
  | "auth.login"
  | "lesson.view"
  | "lesson.start"
  | "lesson.complete"
  | "quiz.submit"
  | "chat.message"
  | "path.generate"
  | "path.select_update"
  | "roadmap.skill_groups_select"
  | "roadmap.skill_groups_admin"
  | "nhatky.log";

async function getSupabaseServiceClient() {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  return createSupabaseServiceClient();
}

// Ghi 1 sự kiện audit. Không chặn luồng chính nếu lỗi (best-effort).
// KHÔNG log nội dung nhạy cảm (đáp án học viên, dữ liệu cá nhân) vào properties.
export async function logAuditEvent(
  userId: string,
  action: AuditAction,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await getSupabaseServiceClient();
    await supabase.from("events").insert({
      user_id: userId,
      event_name: `audit:${action}`,
      properties_json: properties,
    });
  } catch (err) {
    console.error("[audit-log]", action, err);
  }
}

// Ghi 1 sự kiện activity của học viên.
export async function logUserActivity(
  userId: string,
  action: ActivityAction,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await getSupabaseServiceClient();
    await supabase.from("events").insert({
      user_id: userId,
      event_name: `activity:${action}`,
      properties_json: properties,
    });
  } catch (err) {
    console.error("[activity-log]", action, err);
  }
}
