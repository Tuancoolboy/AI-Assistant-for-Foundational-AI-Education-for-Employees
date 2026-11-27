// Bảng xếp hạng từ dữ liệu THẬT: points_ledger (tổng + tuần này) + time_logs (giờ tiết kiệm)
// + tên từ profiles + phòng từ organization_members/departments.
// Dùng service client vì RLS points_ledger chỉ cho đọc điểm của chính mình, còn leaderboard
// cần tổng hợp toàn org (chỉ trả tên + điểm tổng hợp — opt-in ẩn tên xử lý ở UI).

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const runtime = "nodejs";

// 00:00 thứ Hai (UTC) của tuần hiện tại.
function weekStartISO(): string {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day),
  );
  return monday.toISOString();
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "API bảng xếp hạng cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }
  const s = createSupabaseServiceClient();

  // Org của người xem → phạm vi bảng xếp hạng (không org → chỉ chính mình).
  const { data: myMem } = await s
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", session.userId)
    .maybeSingle();
  const orgId = myMem?.organization_id ?? null;

  let memberRows: { user_id: string; department_id: string | null }[] = [];
  if (orgId) {
    const { data } = await s
      .from("organization_members")
      .select("user_id, department_id")
      .eq("organization_id", orgId);
    memberRows = data ?? [];
  } else {
    // Privacy decision: nếu user chưa có org, không trả leaderboard toàn cục.
    // Đảm bảo chỉ hiển thị chính mình để tránh rò rỉ điểm/tên học viên ngoài org.
    memberRows = [{ user_id: session.userId, department_id: null }];
  }
  if (memberRows.length === 0) {
    memberRows = [{ user_id: session.userId, department_id: null }];
  }

  const userIds = [...new Set(memberRows.map((m) => m.user_id))];
  const deptByUser = new Map(memberRows.map((m) => [m.user_id, m.department_id]));

  // Tên phòng.
  const deptIds = [
    ...new Set(memberRows.map((m) => m.department_id).filter(Boolean)),
  ] as string[];
  const deptName = new Map<string, string>();
  if (deptIds.length) {
    const { data } = await s.from("departments").select("id, name").in("id", deptIds);
    for (const d of data ?? []) deptName.set(d.id as string, d.name as string);
  }

  // Tên người.
  const { data: profs } = await s
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  const nameById = new Map(
    (profs ?? []).map((p) => [p.id, p.full_name || p.email || "Học viên"]),
  );

  // Điểm: tổng + tuần này.
  const weekStart = weekStartISO();
  const { data: pts } = await s
    .from("points_ledger")
    .select("user_id, points, created_at")
    .in("user_id", userIds);
  const totalBy = new Map<string, number>();
  const weekBy = new Map<string, number>();
  for (const r of pts ?? []) {
    totalBy.set(r.user_id, (totalBy.get(r.user_id) ?? 0) + (r.points ?? 0));
    if (r.created_at && r.created_at >= weekStart) {
      weekBy.set(r.user_id, (weekBy.get(r.user_id) ?? 0) + (r.points ?? 0));
    }
  }

  // Giờ tiết kiệm.
  const { data: logs } = await s
    .from("time_logs")
    .select("user_id, hours_saved")
    .in("user_id", userIds);
  const hoursBy = new Map<string, number>();
  for (const r of logs ?? []) {
    hoursBy.set(r.user_id, (hoursBy.get(r.user_id) ?? 0) + Number(r.hours_saved ?? 0));
  }

  const rows = userIds.map((uid) => {
    const deptId = deptByUser.get(uid);
    return {
      id: uid,
      name: nameById.get(uid) ?? "Học viên",
      department:
        (deptId && deptName.get(deptId)) ||
        "Chưa có phòng",
      weeklyPoints: weekBy.get(uid) ?? 0,
      totalPoints: totalBy.get(uid) ?? 0,
      hoursSaved: Math.round((hoursBy.get(uid) ?? 0) * 10) / 10,
      isYou: uid === session.userId,
    };
  });

  const youDepartment = rows.find((r) => r.isYou)?.department ?? "Chưa có phòng";
  return apiOk({ rows, youDepartment });
}
