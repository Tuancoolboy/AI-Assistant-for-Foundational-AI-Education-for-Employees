import { apiError, apiOk } from "@/lib/api-error";
import { requireManagerContext } from "@/lib/manager-auth";
import { requirePlatformAdminContext } from "@/lib/platform-admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const runtime = "nodejs";

export type TimelineEvent = {
  id: string;
  type: "event" | "progress" | "quiz" | "time_log";
  action: string;
  detail: string;
  timestamp: string;
  metadata?: unknown;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!isSupabaseConfigured()) return apiError("FORBIDDEN", "Cần Supabase.");

  // Resolve params
  const { userId } = await params;

  // Check auth: Platform Admin OR Manager of this user
  const adminCtx = await requirePlatformAdminContext();
  let isAuthorized = false;

  const s = createSupabaseServiceClient();

  if (adminCtx) {
    isAuthorized = true;
  } else {
    const managerCtx = await requireManagerContext();
    if (managerCtx) {
      // Check if user is in manager's org
      const { data: member } = await s
        .from("organization_members")
        .select("id")
        .eq("organization_id", managerCtx.membership.organizationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (member) isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return apiError("FORBIDDEN", "Không có quyền xem nhật ký hoạt động của nhân viên này.");
  }

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  // Fetch from events
  let eventsQuery = s.from("events").select("id, event_name, properties_json, created_at").eq("user_id", userId);
  if (fromDate) eventsQuery = eventsQuery.gte("created_at", fromDate);
  if (toDate) eventsQuery = eventsQuery.lte("created_at", toDate);
  const { data: rawEvents } = await eventsQuery.limit(1000);

  // Fetch from module_progress
  const progressQuery = s.from("module_progress").select("module_id, status, completed_at, created_at").eq("user_id", userId);
  // completed_at can be null, we use completed_at if status = hoan-thanh, else created_at
  const { data: rawProgress } = await progressQuery;

  // Fetch from quiz_results
  let quizQuery = s.from("quiz_results").select("id, module_id, score, created_at").eq("user_id", userId);
  if (fromDate) quizQuery = quizQuery.gte("created_at", fromDate);
  if (toDate) quizQuery = quizQuery.lte("created_at", toDate);
  const { data: rawQuiz } = await quizQuery.limit(500);

  // Fetch from time_logs
  let timeQuery = s.from("time_logs").select("id, hours_saved, note, logged_at").eq("user_id", userId);
  if (fromDate) timeQuery = timeQuery.gte("logged_at", fromDate);
  if (toDate) timeQuery = timeQuery.lte("logged_at", toDate);
  const { data: rawTimeLogs } = await timeQuery.limit(500);

  const timeline: TimelineEvent[] = [];

  for (const e of rawEvents ?? []) {
    timeline.push({
      id: `ev_${e.id}`,
      type: "event",
      action: e.event_name,
      detail: "",
      timestamp: e.created_at,
      metadata: e.properties_json,
    });
  }

  for (const p of rawProgress ?? []) {
    const ts = p.status === "hoan-thanh" ? p.completed_at : p.created_at;
    if (!ts) continue;
    if (fromDate && ts < fromDate) continue;
    if (toDate && ts > toDate) continue;

    timeline.push({
      id: `prog_${p.module_id}_${p.status}_${new Date(ts).getTime()}`,
      type: "progress",
      action: p.status === "hoan-thanh" ? "Hoàn thành bài học" : "Bắt đầu bài học",
      detail: `Module ID: ${p.module_id}`,
      timestamp: ts,
      metadata: { moduleId: p.module_id, status: p.status },
    });
  }

  for (const q of rawQuiz ?? []) {
    timeline.push({
      id: `quiz_${q.id}`,
      type: "quiz",
      action: "Làm bài kiểm tra",
      detail: `Điểm: ${q.score}`,
      timestamp: q.created_at,
      metadata: { moduleId: q.module_id, score: q.score },
    });
  }

  for (const t of rawTimeLogs ?? []) {
    timeline.push({
      id: `time_${t.id}`,
      type: "time_log",
      action: "Ghi nhận giờ tiết kiệm",
      detail: `Tiết kiệm: ${t.hours_saved}h - ${t.note || "Không có lý do"}`,
      timestamp: t.logged_at,
      metadata: { hoursSaved: t.hours_saved, note: t.note },
    });
  }

  // Sort descending by timestamp
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Simple pagination (could be improved, but sufficient for drawer view)
  const pageStr = searchParams.get("page");
  const pageSizeStr = searchParams.get("pageSize");
  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 50;

  const total = timeline.length;
  const paginated = timeline.slice((page - 1) * pageSize, page * pageSize);

  return apiOk({ items: paginated, total });
}
