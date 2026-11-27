"use client";

import { useState } from "react";

type UnsolvedQuestionCtaProps = {
  question: string;
  aiAttempt?: string;
  roleId?: string | null;
};

export function UnsolvedQuestionCta({
  question,
  aiAttempt,
  roleId,
}: UnsolvedQuestionCtaProps) {
  const [posted, setPosted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePost() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/unsolved-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          ai_attempt: aiAttempt,
          role_id: roleId ?? undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message ?? "Đăng không thành công");
      }
      setPosted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  if (posted) {
    return (
      <div className="mt-2 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-brand">
        Đã đăng, mọi người sẽ vào giúp bạn sớm!
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-secondary/40 px-4 py-3">
      <p className="text-sm text-ink-2">
        Câu này hiện chưa có trong kho bài học. Bạn có muốn đăng lên Topic câu
        hỏi chưa có lời giải để mọi người vào giúp{" "}
        <span className="text-brand">(người giúp được cộng điểm)</span> không?
      </p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <button
        type="button"
        onClick={() => void handlePost()}
        disabled={loading}
        className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand-2 disabled:opacity-50"
      >
        {loading ? "Đang đăng…" : "Đăng lên Topic"}
      </button>
    </div>
  );
}
