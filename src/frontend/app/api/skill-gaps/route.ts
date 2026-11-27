// GET backlog skill_gaps cho người curate (manager/admin). Xem specs/BE-14 §4.3(b).
// RLS skill_gaps chỉ cho manager org SELECT → server client + RLS là đủ chặn.

import { apiError, apiOk } from "@/lib/api-error";
import { requireManagerContext } from "@/lib/manager-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "Tính năng cần Supabase.");
  }
  const ctx = await requireManagerContext();
  if (!ctx || ctx.session.mode !== "supabase") {
    return apiError("FORBIDDEN", "Chỉ quản lý mới xem được.");
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const validStatus = [
    "new",
    "triaged",
    "in-progress",
    "resolved",
    "dismissed",
    "duplicate",
  ];

  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("skill_gaps")
      .select(
        "id, role_id, sample_question, last_question, ai_attempt, best_match_score, " +
          "suggested_skill_slug, occurrence_count, distinct_user_count, status, " +
          "resolved_module_id, first_seen_at, last_seen_at",
      )
      .order("occurrence_count", { ascending: false })
      .limit(200);
    if (statusFilter && validStatus.includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }
    const { data, error } = await query;
    if (error) throw error;
    return apiOk({ gaps: data ?? [] });
  } catch (err) {
    console.error("[skill-gaps:list]", err);
    return apiError("INTERNAL_ERROR", "Chưa tải được backlog.");
  }
}
