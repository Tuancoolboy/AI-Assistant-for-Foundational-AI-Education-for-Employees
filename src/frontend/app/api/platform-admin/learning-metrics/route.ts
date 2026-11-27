// Đo lường học tập cho admin: tổng hợp per-user từ DỮ LIỆU SẴN CÓ (không đổi schema).
// Nguồn: profiles, module_progress, quiz_results, chat_usage, time_logs, points_ledger,
// user_learning_selection, events (active days), auth.users.last_sign_in_at.

import { apiError, apiOk } from "@/lib/api-error";
import { requirePlatformAdminContext } from "@/lib/platform-admin-auth";
import { extractGeneratedLearningPathModuleIds } from "@/lib/learning-path-selection";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import {
  isTimestampInLearningMetricsRange,
  parseLearningMetricsDateRange,
} from "@/lib/learning-metrics-date-range";

export const runtime = "nodejs";

type Row = {
  userId: string;
  name: string;
  email: string;
  roleId: string | null;
  activated: boolean;
  completedCount: number;
  selectedCount: number;
  percent: number;
  quizCount: number;
  quizAvg: number;
  quizPassed: number;
  chatCount: number;
  hoursSaved: number;
  points: number;
  activeDays: number;
  sessionCount: number;
  avgSessionMin: number;
  lastSignIn: string | null;
  lastActivityAt: string | null;
};

function inc(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return apiError("FORBIDDEN", "Cần Supabase.");
  const ctx = await requirePlatformAdminContext();
  if (!ctx) return apiError("FORBIDDEN", "Chỉ quản trị hệ thống mới xem được.");

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const dateRange = parseLearningMetricsDateRange(fromDate, toDate);
  if (!dateRange) {
    return apiError("VALIDATION_ERROR", "Khoảng ngày không hợp lệ.");
  }
  const validatedDateRange = dateRange;
  const hasDateFilter = Boolean(fromDate || toDate);

  const s = createSupabaseServiceClient();

  // Lấy danh sách admin để loại trừ
  const { data: admins } = await s.from("platform_admins").select("user_id");
  const adminIds = new Set((admins ?? []).map((a) => a.user_id));

  // Người dùng thật (bỏ tài khoản test tổng hợp và tài khoản admin).
  const { data: profs } = await s
    .from("profiles")
    .select("id, full_name, email, role_id, learning_activated");

  const lastSignIn = new Map<string, string | null>();
  const authEmailById = new Map<string, string>();
  try {
    const { data: au } = await s.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of au?.users ?? []) {
      lastSignIn.set(u.id, u.last_sign_in_at ?? null);
      if (u.email) authEmailById.set(u.id, u.email);
    }
  } catch {
    // bỏ qua — last_sign_in để null, email fallback lấy từ profiles
  }

  const users = (profs ?? []).filter(
    (p) => {
      const email = String(authEmailById.get(p.id) || p.email || "");
      const normalizedEmail = email.toLowerCase();
      return (
        email.length > 0 &&
        !normalizedEmail.endsWith("@test.local") &&
        !adminIds.has(p.id) &&
        !normalizedEmail.startsWith("admin@") &&
        !normalizedEmail.includes("admin")
      );
    }
  );
  const ids = new Set(users.map((u) => u.id));

  // Gom 1 lần / bảng rồi tổng hợp theo user_id (dữ liệu nhỏ).
  const completed = new Map<string, number>();
  const activeUserIds = new Set<string>();
  const lastActivityAt = new Map<string, string>();

  function recordActivity(userId: string, timestamp: string | null | undefined) {
    if (!ids.has(userId) || !timestamp) return;
    const previous = lastActivityAt.get(userId);
    if (!previous || new Date(timestamp).getTime() > new Date(previous).getTime()) {
      lastActivityAt.set(userId, timestamp);
    }
    if (isTimestampInLearningMetricsRange(timestamp, validatedDateRange)) {
      activeUserIds.add(userId);
    }
  }
  
  // Date aggregation (Asia/Ho_Chi_Minh)
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  function toHCMDate(iso: string) {
    try { return formatter.format(new Date(iso)); } catch { return iso.split("T")[0]; }
  }

  // Cấu trúc gom nhóm chi tiết hoạt động hàng ngày của học viên
  const dailyUserMap = new Map<string, Map<string, { completedCount: number; hoursSaved: number; chatCount: number; quizCount: number; quizSum: number }>>();

  function getOrCreateDailyUser(date: string, userId: string) {
    if (!dailyUserMap.has(date)) {
      dailyUserMap.set(date, new Map());
    }
    const userMap = dailyUserMap.get(date)!;
    if (!userMap.has(userId)) {
      userMap.set(userId, { completedCount: 0, hoursSaved: 0, chatCount: 0, quizCount: 0, quizSum: 0 });
    }
    return userMap.get(userId)!;
  }

  const completedByDateMap = new Map<string, { completedCount: number; activeUsers: Set<string> }>();

  const { data: mp } = await s
    .from("module_progress")
    .select("user_id, status, completed_at");
  for (const r of mp ?? []) {
    if (r.status === "hoan-thanh" && ids.has(r.user_id)) {
      recordActivity(r.user_id, r.completed_at);
      if (!isTimestampInLearningMetricsRange(r.completed_at, validatedDateRange)) continue;
      inc(completed, r.user_id);
      if (r.completed_at) {
        const d = toHCMDate(r.completed_at);
        if (!completedByDateMap.has(d)) completedByDateMap.set(d, { completedCount: 0, activeUsers: new Set() });
        const stat = completedByDateMap.get(d)!;
        stat.completedCount++;
        stat.activeUsers.add(r.user_id);

        const uDetail = getOrCreateDailyUser(d, r.user_id);
        uDetail.completedCount++;
      }
    }
  }

  const selected = new Map<string, number>();
  const { data: sel } = await s.from("user_learning_selection").select("user_id");
  for (const r of sel ?? []) if (ids.has(r.user_id)) inc(selected, r.user_id);

  // Số bài trong lộ trình gợi ý (mẫu số % khi user chưa chốt selection).
  const pathSize = new Map<string, number>();
  const { data: gl } = await s
    .from("generated_learning_paths")
    .select("user_id, result");
  for (const r of gl ?? []) {
    if (!ids.has(r.user_id)) continue;
    const arr = extractGeneratedLearningPathModuleIds(
      (r.result as { orderedModuleIds?: unknown; groups?: unknown } | null) ?? null,
    );
    if (arr.length > 0) pathSize.set(r.user_id, arr.length);
  }

  const quizSum = new Map<string, number>();
  const quizCnt = new Map<string, number>();
  const quizPass = new Map<string, number>();
  const quizByDateMap = new Map<string, number>();
  const { data: qr } = await s
    .from("quiz_results")
    .select("user_id, score, created_at");
  for (const r of qr ?? []) {
    if (!ids.has(r.user_id)) continue;
    recordActivity(r.user_id, r.created_at);
    if (!isTimestampInLearningMetricsRange(r.created_at, validatedDateRange)) continue;
    inc(quizCnt, r.user_id);
    inc(quizSum, r.user_id, r.score ?? 0);
    if ((r.score ?? 0) >= 70) inc(quizPass, r.user_id);

    if (r.created_at) {
      const d = toHCMDate(r.created_at);
      quizByDateMap.set(d, (quizByDateMap.get(d) ?? 0) + 1);
      const uDetail = getOrCreateDailyUser(d, r.user_id);
      uDetail.quizCount++;
      uDetail.quizSum += r.score ?? 0;
    }
  }

  const chat = new Map<string, number>();
  const chatByDateMap = new Map<string, number>();
  const { data: cu } = await s.from("chat_usage").select("user_id, used_at");
  for (const r of cu ?? []) {
    if (!ids.has(r.user_id)) continue;
    recordActivity(r.user_id, r.used_at);
    if (isTimestampInLearningMetricsRange(r.used_at, validatedDateRange)) {
      inc(chat, r.user_id);
      if (r.used_at) {
        const d = toHCMDate(r.used_at);
        chatByDateMap.set(d, (chatByDateMap.get(d) ?? 0) + 1);
        const uDetail = getOrCreateDailyUser(d, r.user_id);
        uDetail.chatCount++;
      }
    }
  }

  const hours = new Map<string, number>();
  const hoursByDateMap = new Map<string, number>();
  const logByDateMap = new Map<string, number>();
  const { data: tl } = await s
    .from("time_logs")
    .select("user_id, hours_saved, logged_at");
  for (const r of tl ?? []) {
    if (!ids.has(r.user_id)) continue;
    recordActivity(r.user_id, r.logged_at);
    if (isTimestampInLearningMetricsRange(r.logged_at, validatedDateRange)) {
      inc(hours, r.user_id, Number(r.hours_saved ?? 0));
      if (r.logged_at) {
        const d = toHCMDate(r.logged_at);
        hoursByDateMap.set(d, (hoursByDateMap.get(d) ?? 0) + Number(r.hours_saved ?? 0));
        logByDateMap.set(d, (logByDateMap.get(d) ?? 0) + 1);

        const uDetail = getOrCreateDailyUser(d, r.user_id);
        uDetail.hoursSaved += Number(r.hours_saved ?? 0);
      }
    }
  }

  const points = new Map<string, number>();
  const { data: pl } = await s
    .from("points_ledger")
    .select("user_id, points, created_at");
  for (const r of pl ?? []) {
    if (
      ids.has(r.user_id) &&
      isTimestampInLearningMetricsRange(r.created_at, validatedDateRange)
    ) {
      inc(points, r.user_id, r.points ?? 0);
    }
  }

  // Số ngày hoạt động + số phiên + tổng thời lượng phiên (từ session_start/session_end).
  const activeDaysSet = new Map<string, Set<string>>();
  const sessionCount = new Map<string, number>();
  const sessionMs = new Map<string, number>();
  const { data: ev } = await s
    .from("events")
    .select("user_id, event_name, properties_json, created_at")
    .limit(20000);
  for (const r of ev ?? []) {
    if (!ids.has(r.user_id)) continue;
    recordActivity(r.user_id, r.created_at);
    if (!isTimestampInLearningMetricsRange(r.created_at, validatedDateRange)) continue;
    if (r.created_at) {
      const day = toHCMDate(r.created_at);
      if (!activeDaysSet.has(r.user_id)) activeDaysSet.set(r.user_id, new Set());
      activeDaysSet.get(r.user_id)!.add(day);
    }
    if (r.event_name === "session_start") inc(sessionCount, r.user_id);
    if (r.event_name === "session_end") {
      const d = Number((r.properties_json as { durationMs?: unknown } | null)?.durationMs ?? 0);
      if (Number.isFinite(d) && d > 0) inc(sessionMs, r.user_id, d);
    }
  }

  for (const [userId, signedInAt] of lastSignIn.entries()) {
    if (signedInAt) {
      const previous = lastActivityAt.get(userId);
      if (
        !previous ||
        new Date(signedInAt).getTime() > new Date(previous).getTime()
      ) {
        lastActivityAt.set(userId, signedInAt);
      }
    }
  }

  const rows: Row[] = users.map((u) => {
    const email = authEmailById.get(u.id) || u.email || "—";
    const comp = completed.get(u.id) ?? 0;
    // Mẫu số % ưu tiên selection đã chốt; chưa chốt → dùng lộ trình gợi ý.
    const selCount = selected.get(u.id) || pathSize.get(u.id) || 0;
    const percent = selCount > 0 ? Math.round((comp / selCount) * 100) : 0;
    const qc = quizCnt.get(u.id) ?? 0;
    return {
      userId: u.id,
      name: u.full_name || email,
      email,
      roleId: u.role_id ?? null,
      activated: Boolean(u.learning_activated),
      completedCount: comp,
      selectedCount: selCount,
      percent,
      quizCount: qc,
      quizAvg: qc > 0 ? Math.round((quizSum.get(u.id) ?? 0) / qc) : 0,
      quizPassed: quizPass.get(u.id) ?? 0,
      chatCount: chat.get(u.id) ?? 0,
      hoursSaved: Math.round((hours.get(u.id) ?? 0) * 10) / 10,
      points: points.get(u.id) ?? 0,
      activeDays: activeDaysSet.get(u.id)?.size ?? 0,
      sessionCount: sessionCount.get(u.id) ?? 0,
      avgSessionMin:
        (sessionCount.get(u.id) ?? 0) > 0
          ? Math.round((sessionMs.get(u.id) ?? 0) / (sessionCount.get(u.id) ?? 1) / 60000)
          : 0,
      lastSignIn: lastSignIn.get(u.id) ?? null,
      lastActivityAt: lastActivityAt.get(u.id) ?? null,
    };
  }).filter((row) => !hasDateFilter || activeUserIds.has(row.userId));

  rows.sort((a, b) => b.percent - a.percent || b.completedCount - a.completedCount);

  const n = rows.length || 1;
  const summary = {
    totalUsers: rows.length,
    activatedCount: rows.filter((r) => r.activated).length,
    learningCount: rows.filter((r) => r.completedCount > 0).length,
    avgPercent: Math.round(rows.reduce((a, r) => a + r.percent, 0) / n),
    totalCompleted: rows.reduce((a, r) => a + r.completedCount, 0),
    avgQuiz: Math.round(
      rows.filter((r) => r.quizCount > 0).reduce((a, r) => a + r.quizAvg, 0) /
        (rows.filter((r) => r.quizCount > 0).length || 1),
    ),
    totalChat: rows.reduce((a, r) => a + r.chatCount, 0),
    totalHours: Math.round(rows.reduce((a, r) => a + r.hoursSaved, 0) * 10) / 10,
    totalPoints: rows.reduce((a, r) => a + r.points, 0),
  };

  const allDates = new Set([
    ...completedByDateMap.keys(), 
    ...hoursByDateMap.keys(),
    ...quizByDateMap.keys(),
    ...chatByDateMap.keys(),
    ...logByDateMap.keys()
  ]);
  const completedByDate = Array.from(allDates)
    .map((date) => {
      const cStat = completedByDateMap.get(date);
      const activityCount = 
        (cStat?.completedCount ?? 0) + 
        (quizByDateMap.get(date) ?? 0) + 
        (chatByDateMap.get(date) ?? 0) + 
        (logByDateMap.get(date) ?? 0);
      return {
        date,
        completedCount: cStat?.completedCount ?? 0,
        activeLearners: cStat?.activeUsers.size ?? 0,
        hoursSaved: Math.round((hoursByDateMap.get(date) ?? 0) * 10) / 10,
        activityCount,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const dailyDetails: {
    date: string;
    userId: string;
    name: string;
    email: string;
    roleId: string | null;
    completedCount: number;
    hoursSaved: number;
    chatCount: number;
    quizCount: number;
    quizAvg: number;
  }[] = [];

  const userLookup = new Map(users.map((u) => [u.id, u]));

  for (const [date, userMap] of dailyUserMap.entries()) {
    for (const [userId, stats] of userMap.entries()) {
      const u = userLookup.get(userId);
      if (!u) continue;
      dailyDetails.push({
        date,
        userId,
        name: u.full_name || u.email || "—",
        email: u.email as string,
        roleId: u.role_id ?? null,
        completedCount: stats.completedCount,
        hoursSaved: Math.round(stats.hoursSaved * 10) / 10,
        chatCount: stats.chatCount,
        quizCount: stats.quizCount,
        quizAvg: stats.quizCount > 0 ? Math.round(stats.quizSum / stats.quizCount) : 0,
      });
    }
  }
  dailyDetails.sort((a, b) => a.date.localeCompare(b.date));

  return apiOk({ rows, summary, completedByDate, dailyDetails });
}
