import { apiError, apiOk } from "@/lib/api-error";
import { requirePlatformAdminContext } from "@/lib/platform-admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatTrajectoryError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export async function GET(request: Request) {
  const context = await requirePlatformAdminContext();
  if (!context) {
    return apiError("FORBIDDEN", "Chỉ quản trị hệ thống mới xem được quỹ đạo học tập.");
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const targetTime = searchParams.get("targetTime");

  if (!studentId) {
    return apiError("VALIDATION_ERROR", "Thiếu studentId.");
  }

  if (!UUID_RE.test(studentId)) {
    return apiError("VALIDATION_ERROR", "studentId phải là UUID hợp lệ.");
  }

  try {
    const supabaseAdmin = createSupabaseServiceClient();

    if (targetTime) {
      // Fetch snapshot at specific time using RPC
      const { data, error } = await supabaseAdmin.rpc("get_student_trajectory_at", {
        p_student_id: studentId,
        p_target_time: targetTime,
      });

      if (error) {
        throw error;
      }

      return apiOk({
        edges: data || [],
        reasoning: [], // Mocked as empty since reasoning is not persisted yet
      });
    } else {
      // Fetch all edges for the student to allow client to determine time range
      const { data, error } = await supabaseAdmin
        .from("temporal_knowledge_edges")
        .select("*")
        .eq("student_id", studentId)
        .order("valid_from", { ascending: true });

      if (error) {
        throw error;
      }

      return apiOk({
        edges: data || [],
        reasoning: [], // Mocked as empty
      });
    }
  } catch (error) {
    const err = error as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error("[trajectory:get]", formatTrajectoryError(err), err);
    // Graceful fallback for schema cache errors (PGRST205) or missing relation errors
    if (
      err?.code === "PGRST205" ||
      err?.message?.includes("temporal_knowledge_edges") ||
      err?.message?.includes("get_student_trajectory_at")
    ) {
      console.warn(
        "[trajectory:get] Degraded state: temporal_knowledge_edges is currently desynchronized or cache expired. Returning fallback data.",
      );
      return apiOk({
        edges: [],
        reasoning: [],
        degraded: true,
        warning: "Hệ thống đang đồng bộ cấu trúc dữ liệu. Quỹ đạo học tập tạm thời chưa hiển thị đầy đủ.",
      });
    }
    return apiError("INTERNAL_ERROR", "Không lấy được dữ liệu quỹ đạo học tập.");
  }
}
