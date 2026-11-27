// GET /api/member/roadmap — cây Nhóm Kỹ năng → 4 cấp → Bài (kèm isSelected + status + %).
// Opt-out model. Empty state (chưa có nhóm) → groups: [] (KHÔNG 500).

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { getRoadmapTree } from "@/lib/roadmap-service";
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
    const groups = await getRoadmapTree(supabase, session.userId);
    return apiOk({ groups });
  } catch (err) {
    console.error("[member:roadmap:get]", (err as Error).message);
    return apiError("INTERNAL_ERROR", "Không đọc được lộ trình.");
  }
}
