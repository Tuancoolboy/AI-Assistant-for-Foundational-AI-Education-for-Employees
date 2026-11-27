// POST chấp nhận 1 lời giải. Chỉ người đăng câu hỏi hoặc manager. Xem specs/BE-14 §4.1 + §3.2.
// Set is_accepted + question='answered' + cộng điểm cho helper qua service role
// (RLS points_ledger chỉ cho user tự ghi điểm mình, nên award cho người khác phải dùng service).

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getManagerMembershipForUser } from "@/lib/manager-auth";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

// Dùng source 'challenge' để khỏi migrate CHECK constraint của points_ledger.source
// (allowed: lesson|share|challenge). Xem specs/notes BE-14.
const HELP_POINTS_SOURCE = "challenge";
const HELP_ACCEPTED_POINTS = 15;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; helpId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "Tính năng cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }
  const { id, helpId } = await params;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: question, error: qErr } = await supabase
      .from("unsolved_questions")
      .select("id, user_id, organization_id, status")
      .eq("id", id)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!question) return apiError("NOT_FOUND", "Không tìm thấy câu hỏi.");
    // Cap điểm: chỉ thưởng 1 lần/câu hỏi. Đã 'answered' → không accept thêm để tránh
    // cộng điểm lặp cho nhiều help của cùng câu hỏi.
    if (question.status === "answered") {
      return apiOk({ alreadyAnswered: true });
    }

    // Quyền: người đăng hoặc manager của org câu hỏi.
    let allowed = question.user_id === session.userId;
    if (!allowed) {
      const membership = await getManagerMembershipForUser(session.userId);
      allowed = Boolean(
        membership &&
          question.organization_id &&
          membership.organizationId === question.organization_id,
      );
    }
    if (!allowed) {
      return apiError("FORBIDDEN", "Chỉ người đăng hoặc quản lý mới chấp nhận.");
    }

    const { data: help, error: hErr } = await supabase
      .from("unsolved_question_helps")
      .select("id, helper_user_id, is_accepted")
      .eq("id", helpId)
      .eq("question_id", id)
      .maybeSingle();
    if (hErr) throw hErr;
    if (!help) return apiError("NOT_FOUND", "Không tìm thấy lời giải.");
    if (help.is_accepted) return apiOk({ alreadyAccepted: true });

    // Cập nhật help + question (RLS update cho owner/manager đã pass ở trên).
    const { error: upHelpErr } = await supabase
      .from("unsolved_question_helps")
      .update({ is_accepted: true })
      .eq("id", helpId);
    if (upHelpErr) throw upHelpErr;

    const { error: upQErr } = await supabase
      .from("unsolved_questions")
      .update({ status: "answered" })
      .eq("id", id);
    if (upQErr) throw upQErr;

    // Cộng điểm cho helper (service role để ghi điểm cho user khác).
    try {
      const service = createSupabaseServiceClient();
      const { data: helperMembership } = await service
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", help.helper_user_id)
        .maybeSingle();
      const { error: pointsErr } = await service.from("points_ledger").insert({
        user_id: help.helper_user_id,
        organization_id:
          helperMembership?.organization_id ?? question.organization_id ?? null,
        source: HELP_POINTS_SOURCE,
        points: HELP_ACCEPTED_POINTS,
        ref_id: id,
      });
      if (pointsErr) console.error("[unsolved-accept:points]", pointsErr.message);
    } catch (pointsErr) {
      console.error("[unsolved-accept:points]", pointsErr);
    }

    return apiOk({ accepted: true, points: HELP_ACCEPTED_POINTS });
  } catch (err) {
    console.error("[unsolved-questions:accept]", err);
    return apiError("INTERNAL_ERROR", "Chưa chấp nhận được lời giải.");
  }
}
