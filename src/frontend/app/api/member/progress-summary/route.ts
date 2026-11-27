// GET /api/member/progress-summary — tổng %, số bài chọn, tổng hoàn thành, theo nhóm.
// Mầm dashboard GĐ2. % opt-out (mẫu số = is_selected=true).

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { getProgressSummary } from "@/lib/roadmap-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    const summary = await getProgressSummary(supabase, session.userId);
    return apiOk(summary);
  } catch (err) {
    console.error("[member:progress-summary]", (err as Error).message);
    return apiError("INTERNAL_ERROR", "Không đọc được tiến độ.");
  }
}
