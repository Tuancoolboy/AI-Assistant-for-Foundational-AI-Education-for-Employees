// Topic câu hỏi chưa có lời giải (cộng đồng, opt-in). Xem specs/BE-14 §4.1.
// POST: người dùng đăng câu hỏi case C lên Topic (gắn skill_gap_id nếu có).
// GET: list theo org (RLS chặn ở DB) cho bảng Topic.

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

type CreatePayload = {
  question?: unknown;
  ai_attempt?: unknown;
  role_id?: unknown;
  skill_gap_id?: unknown;
};

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "Tính năng cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }

  let body: CreatePayload;
  try {
    body = (await request.json()) as CreatePayload;
  } catch {
    return apiError("VALIDATION_ERROR", "JSON không hợp lệ.");
  }

  const question = str(body.question, 1000);
  if (!question) return apiError("VALIDATION_ERROR", "Thiếu nội dung câu hỏi.");
  const aiAttempt = str(body.ai_attempt, 1000) || null;
  const roleId = str(body.role_id, 40) || null;
  const skillGapId = str(body.skill_gap_id, 60) || null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", session.userId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("unsolved_questions")
      .insert({
        user_id: session.userId,
        organization_id: membership?.organization_id ?? null,
        skill_gap_id: skillGapId,
        role_id: roleId,
        question,
        ai_attempt: aiAttempt,
      })
      .select("id")
      .single();
    if (error) throw error;
    return apiOk({ id: data.id });
  } catch (err) {
    console.error("[unsolved-questions:create]", err);
    return apiError("INTERNAL_ERROR", "Chưa đăng được câu hỏi.");
  }
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "Tính năng cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  try {
    const supabase = await createSupabaseServerClient();
    // RLS chỉ trả câu hỏi cùng org của user (hoặc của chính họ).
    let query = supabase
      .from("unsolved_questions")
      .select(
        "id, question, ai_attempt, role_id, status, created_at, user_id, " +
          "unsolved_question_helps(id, answer, is_accepted, helper_user_id, created_at)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (statusFilter && ["open", "answered", "closed"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }
    const { data, error } = await query;
    if (error) throw error;

    type HelpRow = {
      id: string;
      answer: string;
      is_accepted: boolean;
      helper_user_id: string;
      created_at: string;
    };
    type QuestionRow = {
      id: string;
      question: string;
      ai_attempt: string | null;
      role_id: string | null;
      status: string;
      created_at: string;
      user_id: string;
      unsolved_question_helps: HelpRow[] | null;
    };
    const rows = (data ?? []) as unknown as QuestionRow[];

    // RLS trên profiles chỉ cho self-read; dùng service client để map tên người
    // đăng + helper (read-only, scope theo userIds đã org-scoped ở query trên).
    const userIds = new Set<string>();
    for (const row of rows) {
      if (row.user_id) userIds.add(row.user_id);
      const helps = row.unsolved_question_helps ?? [];
      for (const help of helps) {
        if (help.helper_user_id) userIds.add(help.helper_user_id);
      }
    }
    const profileMap = new Map<string, string | null>();
    if (userIds.size > 0) {
      const service = createSupabaseServiceClient();
      const { data: profiles } = await service
        .from("profiles")
        .select("id, full_name")
        .in("id", [...userIds]);
      for (const profile of profiles ?? []) {
        profileMap.set(profile.id, profile.full_name);
      }
    }

    const questions = rows.map((row) => {
      const helps = row.unsolved_question_helps ?? [];
      return {
        ...row,
        author_name: profileMap.get(row.user_id) ?? null,
        unsolved_question_helps: helps.map((help) => ({
          ...help,
          helper_name: profileMap.get(help.helper_user_id) ?? null,
        })),
      };
    });

    return apiOk({
      questions,
      currentUserId: session.userId,
    });
  } catch (err) {
    console.error("[unsolved-questions:list]", err);
    return apiError("INTERNAL_ERROR", "Chưa tải được danh sách.");
  }
}
