"use client";

import { useState, useEffect, useCallback } from "react";
import { ROLES } from "@/lib/roles";

const ROLE_OPTIONS = Object.values(ROLES).map((r) => ({
  id: r.id,
  label: r.label,
}));
const MIN_QUESTION_LEN = 10;
const MAX_QUESTION_LEN = 1000;
const FALLBACK_NAME = "Ẩn danh";

function displayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_NAME;
}

type HelpItem = {
  id: string;
  answer: string;
  is_accepted: boolean;
  helper_user_id: string;
  helper_name: string | null;
  created_at: string;
};

type QuestionItem = {
  id: string;
  question: string;
  ai_attempt: string | null;
  role_id: string | null;
  status: string;
  created_at: string;
  user_id: string;
  author_name: string | null;
  unsolved_question_helps: HelpItem[];
};

type ApiResponse = {
  ok: boolean;
  questions: QuestionItem[];
  currentUserId: string | null;
};

export function TopicCauHoiBoard() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAi, setExpandedAi] = useState<Set<string>>(new Set());
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [accepting, setAccepting] = useState<Record<string, boolean>>({});

  // Form đăng câu hỏi mới (do người dùng tự nhập).
  const [newQuestion, setNewQuestion] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/unsolved-questions?status=open");
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) throw new Error("Tải dữ liệu thất bại");
      setQuestions(data.questions);
      setCurrentUserId(data.currentUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — separate from loadQuestions to satisfy react-hooks/set-state-in-effect
  useEffect(() => {
    let cancelled = false;
    fetch("/api/unsolved-questions?status=open")
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled) return;
        if (!data.ok) throw new Error("Tải dữ liệu thất bại");
        setQuestions(data.questions);
        setCurrentUserId(data.currentUserId);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Lỗi không xác định");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmitQuestion() {
    const question = newQuestion.trim();
    if (question.length < MIN_QUESTION_LEN || question.length > MAX_QUESTION_LEN) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch("/api/unsolved-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          role_id: newRoleId || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error?.message ?? "Đăng câu hỏi thất bại");
      setNewQuestion("");
      setNewRoleId("");
      await loadQuestions();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setPosting(false);
    }
  }

  async function handleSubmitHelp(questionId: string) {
    const answer = answerInputs[questionId]?.trim();
    if (!answer) return;
    setSubmitting((prev) => ({ ...prev, [questionId]: true }));
    try {
      const res = await fetch(`/api/unsolved-questions/${questionId}/help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error?.message ?? "Lỗi gửi lời giải");
      setAnswerInputs((prev) => ({ ...prev, [questionId]: "" }));
      await loadQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSubmitting((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function handleAccept(questionId: string, helpId: string) {
    setAccepting((prev) => ({ ...prev, [helpId]: true }));
    try {
      const res = await fetch(
        `/api/unsolved-questions/${questionId}/help/${helpId}/accept`,
        { method: "POST" },
      );
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error?.message ?? "Lỗi chấp nhận lời giải");
      await loadQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setAccepting((prev) => ({ ...prev, [helpId]: false }));
    }
  }

  const trimmedNewQ = newQuestion.trim().length;
  const newQValid =
    trimmedNewQ >= MIN_QUESTION_LEN && trimmedNewQ <= MAX_QUESTION_LEN;

  const newQuestionForm = (
    <div className="rounded-2xl border border-line bg-card px-5 py-4 shadow-sm">
      <p className="text-sm font-semibold text-ink">Đăng câu hỏi mới</p>
      <p className="mt-0.5 text-xs text-ink-3">
        Nhập câu hỏi bạn đang gặp khó để đồng nghiệp giúp ({MIN_QUESTION_LEN}–{MAX_QUESTION_LEN} ký tự).
      </p>
      <textarea
        value={newQuestion}
        onChange={(e) => setNewQuestion(e.target.value.slice(0, MAX_QUESTION_LEN))}
        placeholder="Câu hỏi của bạn…"
        rows={3}
        className="mt-3 w-full resize-none rounded-xl border border-line bg-background px-4 py-2.5 text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={newRoleId}
          onChange={(e) => setNewRoleId(e.target.value)}
          className="h-9 rounded-lg border border-line bg-background px-3 text-sm focus:border-brand focus:outline-none"
        >
          <option value="">— Chọn vai trò (tuỳ chọn) —</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-3">
          {trimmedNewQ}/{MAX_QUESTION_LEN}
        </span>
        <button
          type="button"
          disabled={!newQValid || posting}
          onClick={() => void handleSubmitQuestion()}
          className="ml-auto inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand-2 disabled:opacity-50"
        >
          {posting ? "Đang đăng…" : "Đăng câu hỏi"}
        </button>
      </div>
      {postError && <p className="mt-2 text-xs text-red-500">{postError}</p>}
    </div>
  );

  let listContent: React.ReactNode;
  if (loading) {
    listContent = (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    );
  } else if (error) {
    listContent = (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
        {error}
      </div>
    );
  } else if (questions.length === 0) {
    listContent = (
      <div className="rounded-xl border border-line bg-card px-6 py-10 text-center">
        <p className="text-ink-2">
          Chưa có câu hỏi nào. Đăng câu hỏi đầu tiên ở trên hoặc dùng Trợ lý AI!
        </p>
      </div>
    );
  } else {
    listContent = (
      <>
        <p className="text-sm text-ink-2">
          Lời giải được chấp nhận: <span className="font-semibold text-brand">+15 điểm</span>
        </p>
        {questions.map((q) => {
          const isOwner = currentUserId === q.user_id;
          const aiExpanded = expandedAi.has(q.id);

          return (
            <div
              key={q.id}
              className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm"
            >
              {/* Question header */}
              <div className="border-b border-line bg-gradient-to-r from-card to-secondary/30 px-5 py-4">
                <p className="font-medium text-ink">{q.question}</p>
                <p className="mt-1 text-xs text-ink-3">— {displayName(q.author_name)}</p>
                {q.role_id && (
                  <span className="mt-1.5 inline-block rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                    {q.role_id}
                  </span>
                )}
              </div>

            {/* AI attempt (collapsible) */}
            {q.ai_attempt && (
              <div className="border-b border-line px-5 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedAi((prev) => {
                      const next = new Set(prev);
                      if (next.has(q.id)) next.delete(q.id);
                      else next.add(q.id);
                      return next;
                    })
                  }
                  className="text-xs font-medium text-ink-2 hover:text-ink"
                >
                  {aiExpanded ? "▲ Ẩn câu trả lời AI" : "▼ Xem câu trả lời AI (chưa đầy đủ)"}
                </button>
                {aiExpanded && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{q.ai_attempt}</p>
                )}
              </div>
            )}

            {/* Helps list */}
            {q.unsolved_question_helps.length > 0 && (
              <div className="divide-y divide-line">
                {q.unsolved_question_helps.map((help) => (
                  <div key={help.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-secondary text-xs text-ink-2">
                        🙋
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed text-ink">{help.answer}</p>
                        <p className="mt-1 text-xs text-ink-3">— {displayName(help.helper_name)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-none">
                        {help.is_accepted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                            ✓ Đã chấp nhận
                          </span>
                        ) : isOwner ? (
                          <button
                            type="button"
                            disabled={accepting[help.id]}
                            onClick={() => void handleAccept(q.id, help.id)}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-brand px-3 text-xs font-medium text-brand transition hover:bg-brand/10 disabled:opacity-50"
                          >
                            {accepting[help.id] ? "Đang…" : "Chấp nhận"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Answer form */}
            <div className="bg-secondary/20 px-5 py-4">
              <textarea
                value={answerInputs[q.id] ?? ""}
                onChange={(e) =>
                  setAnswerInputs((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                placeholder="Chia sẻ lời giải của bạn…"
                rows={2}
                className="w-full resize-none rounded-xl border border-line bg-card px-4 py-2.5 text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-ink-3">Lời giải được chấp nhận: +15 điểm</p>
                <button
                  type="button"
                  disabled={!answerInputs[q.id]?.trim() || submitting[q.id]}
                  onClick={() => void handleSubmitHelp(q.id)}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand-2 disabled:opacity-50"
                >
                  {submitting[q.id] ? "Đang gửi…" : "Gửi lời giải"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {newQuestionForm}
      {listContent}
    </div>
  );
}
