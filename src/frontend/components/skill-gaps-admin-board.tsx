"use client";

import { useState, useEffect, useCallback } from "react";

type SkillGap = {
  id: string;
  role_id: string | null;
  sample_question: string;
  last_question: string | null;
  ai_attempt: string | null;
  best_match_score: number | null;
  suggested_skill_slug: string | null;
  occurrence_count: number;
  distinct_user_count: number;
  status: string;
  resolved_module_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

type ApiGapsResponse = {
  ok: boolean;
  gaps: SkillGap[];
};

const ROLE_OPTIONS = [
  { value: "kinh-doanh", label: "Kinh doanh" },
  { value: "ke-toan", label: "Kế toán" },
  { value: "marketing", label: "Marketing" },
  { value: "van-hanh", label: "Vận hành" },
  { value: "khac", label: "Khác" },
] as const;

type RoleId = "kinh-doanh" | "ke-toan" | "marketing" | "van-hanh" | "khac";

const STATUS_LABELS: Record<string, string> = {
  new: "Mới",
  triaged: "Đã phân loại",
  dismissed: "Bỏ qua",
  duplicate: "Trùng lặp",
  "in-progress": "Đang xử lý",
};

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    triaged: "bg-yellow-100 text-yellow-700",
    dismissed: "bg-gray-100 text-gray-500",
    duplicate: "bg-orange-100 text-orange-700",
    "in-progress": "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

type PromoteFormState = {
  title: string;
  summary: string;
  content: string;
  role_id: RoleId;
  skill_slug: string;
};

function PromoteForm({
  gapId,
  defaultRoleId,
  onDone,
}: {
  gapId: string;
  defaultRoleId: string | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState<PromoteFormState>({
    title: "",
    summary: "",
    content: "",
    role_id: (defaultRoleId as RoleId) ?? "khac",
    skill_slug: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!form.title.trim() || !form.summary.trim()) {
      setErr("Vui lòng điền tiêu đề và tóm tắt");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        role_id: form.role_id,
      };
      if (form.content.trim()) body.content = form.content.trim();
      if (form.skill_slug.trim()) body.skill_slug = form.skill_slug.trim();

      const res = await fetch(`/api/skill-gaps/${gapId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error?.message ?? "Promote thất bại");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-4 space-y-3">
      <p className="text-xs font-semibold text-brand">Tạo module từ skill gap</p>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <input
        type="text"
        placeholder="Tiêu đề module *"
        value={form.title}
        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <input
        type="text"
        placeholder="Tóm tắt *"
        value={form.summary}
        onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <textarea
        placeholder="Nội dung (tùy chọn)"
        value={form.content}
        onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
        rows={2}
        className="w-full resize-none rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <div className="flex gap-2">
        <select
          value={form.role_id}
          onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value as RoleId }))}
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-brand focus:outline-none"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="skill_slug (tùy chọn)"
          value={form.skill_slug}
          onChange={(e) => setForm((p) => ({ ...p, skill_slug: e.target.value }))}
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand-2 disabled:opacity-50"
        >
          {loading ? "Đang tạo…" : "Tạo module"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-line px-4 text-sm text-ink-2 transition hover:bg-secondary"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

function GapRow({
  gap,
  onRefresh,
}: {
  gap: SkillGap;
  onRefresh: () => void;
}) {
  const [slugInput, setSlugInput] = useState(gap.suggested_skill_slug ?? "");
  const [patching, setPatching] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

  async function patch(updates: { status?: string; suggested_skill_slug?: string }) {
    setPatching(true);
    try {
      const res = await fetch(`/api/skill-gaps/${gap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error?.message ?? "Cập nhật thất bại");
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setPatching(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        {/* Main info */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-medium text-ink leading-snug">{gap.sample_question}</p>
          {gap.role_id && (
            <span className="inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              {gap.role_id}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex shrink-0 gap-4 text-center text-sm">
          <div>
            <p className="font-bold text-ink">{gap.occurrence_count}</p>
            <p className="text-xs text-ink-3">lần hỏi</p>
          </div>
          <div>
            <p className="font-bold text-ink">{gap.distinct_user_count}</p>
            <p className="text-xs text-ink-3">user</p>
          </div>
          {gap.best_match_score !== null && (
            <div>
              <p className="font-bold text-ink">{(gap.best_match_score * 100).toFixed(0)}%</p>
              <p className="text-xs text-ink-3">khớp gần nhất</p>
            </div>
          )}
          <div className="flex items-start pt-0.5">
            <StatusBadge status={gap.status} />
          </div>
        </div>
      </div>

      {/* Triage controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={patching || gap.status === "triaged"}
          onClick={() => void patch({ status: "triaged" })}
          className="inline-flex h-7 items-center rounded-lg border border-yellow-300 bg-yellow-50 px-3 text-xs font-medium text-yellow-700 transition hover:bg-yellow-100 disabled:opacity-40"
        >
          Phân loại
        </button>
        <button
          type="button"
          disabled={patching || gap.status === "dismissed"}
          onClick={() => void patch({ status: "dismissed" })}
          className="inline-flex h-7 items-center rounded-lg border border-line px-3 text-xs font-medium text-ink-2 transition hover:bg-secondary disabled:opacity-40"
        >
          Bỏ qua
        </button>
        <button
          type="button"
          disabled={patching || gap.status === "duplicate"}
          onClick={() => void patch({ status: "duplicate" })}
          className="inline-flex h-7 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-medium text-orange-600 transition hover:bg-orange-100 disabled:opacity-40"
        >
          Trùng lặp
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="suggested_skill_slug"
            className="h-7 rounded-lg border border-line bg-card px-2.5 text-xs focus:border-brand focus:outline-none w-40"
          />
          <button
            type="button"
            disabled={patching}
            onClick={() => void patch({ suggested_skill_slug: slugInput })}
            className="inline-flex h-7 items-center rounded-lg border border-line px-3 text-xs font-medium text-ink-2 transition hover:bg-secondary disabled:opacity-40"
          >
            Lưu slug
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowPromote((v) => !v)}
          className="inline-flex h-7 items-center rounded-lg bg-brand/10 px-3 text-xs font-semibold text-brand transition hover:bg-brand/20"
        >
          {showPromote ? "Hủy promote" : "Promote → module"}
        </button>
      </div>

      {showPromote && (
        <PromoteForm
          gapId={gap.id}
          defaultRoleId={gap.role_id}
          onDone={() => {
            setShowPromote(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

export function SkillGapsAdminBoard() {
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGaps = useCallback(async () => {
    try {
      const res = await fetch("/api/skill-gaps?status=new");
      const data = (await res.json()) as ApiGapsResponse;
      if (!res.ok || !data.ok) throw new Error("Tải dữ liệu thất bại");
      const sorted = [...data.gaps].sort((a, b) => b.occurrence_count - a.occurrence_count);
      setGaps(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — separate fetch to satisfy react-hooks/set-state-in-effect
  useEffect(() => {
    let cancelled = false;
    fetch("/api/skill-gaps?status=new")
      .then((r) => r.json())
      .then((data: ApiGapsResponse) => {
        if (cancelled) return;
        if (!data.ok) throw new Error("Tải dữ liệu thất bại");
        const sorted = [...data.gaps].sort((a, b) => b.occurrence_count - a.occurrence_count);
        setGaps(sorted);
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (gaps.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-card px-6 py-10 text-center">
        <p className="text-ink-2">Không có skill gap nào ở trạng thái mới.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-secondary/40 text-left text-xs font-semibold text-ink-2">
              <th className="px-4 py-3">Câu hỏi tiêu biểu</th>
              <th className="px-4 py-3 text-center">Số lần hỏi</th>
              <th className="px-4 py-3 text-center">Số user</th>
              <th className="px-4 py-3 text-center">Điểm khớp</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {gaps.map((gap) => (
              <tr key={gap.id} className="text-ink">
                <td className="max-w-xs truncate px-4 py-3">{gap.sample_question}</td>
                <td className="px-4 py-3 text-center font-semibold">{gap.occurrence_count}</td>
                <td className="px-4 py-3 text-center">{gap.distinct_user_count}</td>
                <td className="px-4 py-3 text-center">
                  {gap.best_match_score !== null
                    ? `${(gap.best_match_score * 100).toFixed(0)}%`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={gap.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        {gaps.map((gap) => (
          <GapRow key={gap.id} gap={gap} onRefresh={() => void loadGaps()} />
        ))}
      </div>
    </div>
  );
}
