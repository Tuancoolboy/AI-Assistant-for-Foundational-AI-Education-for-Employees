// Route Agent sinh lộ trình cá nhân hóa (2 luồng). OpenAI server-side, KHÔNG lộ key.
// Route chỉ lo auth/guard; agent service tự resolve Supabase context, cache, và
// preview phòng ban.

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { canAccessLearning, loadLearningActivationRecord } from "@/lib/learning-activation";
import {
  runLearningPathAgent,
  type LearningPathAgentPayload,
} from "@/lib/agent/path-agent-service";
import { logUserActivity } from "@/lib/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await resolveApiSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập để tạo lộ trình.");
  }

  let body: LearningPathAgentPayload = {};
  try {
    body = (await request.json()) as LearningPathAgentPayload;
  } catch {
    // Body rỗng vẫn hợp lệ
  }

  if (session.mode === "supabase") {
    const access = await loadLearningActivationRecord(session.userId);
    if (!canAccessLearning(access)) {
      return apiError("FORBIDDEN", "ACCOUNT_NOT_ACTIVATED");
    }
  }


  try {
    const result = await runLearningPathAgent(session, body);
    void logUserActivity(session.userId, "path.generate", { source: result.source });
    return apiOk({
      path: result.path,
      source: result.source,
      cached: result.cached,
    });
  } catch (err) {
    console.error("[agent-lo-trinh]", err);
    return apiError("INTERNAL_ERROR", "Không tạo được lộ trình. Thử lại sau.");
  }
}
