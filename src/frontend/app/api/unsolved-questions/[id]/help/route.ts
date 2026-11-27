// POST help cho 1 câu hỏi Topic. Người giúp tạo lời giải. Xem specs/BE-14 §4.1.

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

type HelpPayload = { answer?: unknown };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "Tính năng cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }
  const { id } = await params;

  let body: HelpPayload;
  try {
    body = (await request.json()) as HelpPayload;
  } catch {
    return apiError("VALIDATION_ERROR", "JSON không hợp lệ.");
  }
  const answer =
    typeof body.answer === "string" ? body.answer.trim().slice(0, 4000) : "";
  if (!answer) return apiError("VALIDATION_ERROR", "Thiếu nội dung trả lời.");

  try {
    const supabase = await createSupabaseServerClient();
    // RLS: select chỉ thấy câu hỏi cùng org → chặn help vào câu hỏi org khác.
    const { data: question, error: qErr } = await supabase
      .from("unsolved_questions")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!question) return apiError("NOT_FOUND", "Không tìm thấy câu hỏi.");
    // Chống tự thưởng điểm: không cho người đăng tự giúp câu hỏi của mình.
    if (question.user_id === session.userId) {
      return apiError("FORBIDDEN", "Không thể tự giúp câu hỏi của chính mình.");
    }

    const { data, error } = await supabase
      .from("unsolved_question_helps")
      .insert({
        question_id: id,
        helper_user_id: session.userId,
        answer,
      })
      .select("id")
      .single();
    if (error) throw error;
    return apiOk({ id: data.id });
  } catch (err) {
    console.error("[unsolved-questions:help]", err);
    return apiError("INTERNAL_ERROR", "Chưa gửi được lời giải.");
  }
}
