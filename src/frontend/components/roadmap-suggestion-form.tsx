"use client";

// Màn "Lộ trình gợi ý" — Step 1 của 2-screen flow.
// Mount: seed gợi ý → GET lộ trình → render checkbox per module.
// Submit: POST /confirm với danh sách bỏ tích → redirect /lo-trinh.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RoadmapModuleCheckbox } from "@/components/roadmap-module-checkbox";

type ModuleStatus = "chua-hoc" | "dang-hoc" | "hoan-thanh";

type ModuleNode = {
  id: string;
  title: string;
  isSelected: boolean;
  status: ModuleStatus;
};

type LevelNode = {
  level: number;
  label: string;
  modules: ModuleNode[];
};

type GroupNode = {
  slug: string;
  label: string;
  percent: number;
  levels: LevelNode[];
};

type ApiRoadmapResponse = {
  ok: boolean;
  groups: GroupNode[];
};

// ---------- Group section ----------

type GroupSectionProps = {
  group: GroupNode;
  selection: Record<string, boolean>;
  onToggle: (moduleId: string, next: boolean) => void;
};

function GroupSection({ group, selection, onToggle }: GroupSectionProps) {
  const allIds = group.levels.flatMap((l) => l.modules.map((m) => m.id));
  const selectedCount = allIds.filter((id) => selection[id]).length;
  const nonEmptyLevels = group.levels.filter((l) => l.modules.length > 0);

  return (
    <details className="rounded-2xl border border-line bg-card shadow-sm open:shadow-md" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 select-none">
        <span className="font-display text-base font-bold text-ink">{group.label}</span>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-ink-2">
            {selectedCount}/{allIds.length} bài
          </span>
          <svg
            className="h-4 w-4 flex-none text-ink-3 transition-transform [[open]_&]:rotate-180"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </summary>

      <div className="px-5 pb-5">
        {nonEmptyLevels.map((level) => (
          <div key={level.level} className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">
              {level.label}
            </p>
            <ul className="space-y-2">
              {level.modules.map((mod) => (
                <RoadmapModuleCheckbox
                  key={mod.id}
                  moduleId={mod.id}
                  title={mod.title}
                  isSelected={selection[mod.id] ?? mod.isSelected}
                  status={mod.status}
                  disabled={false}
                  onToggle={onToggle}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

// ---------- Main form ----------

export function RoadmapSuggestionForm() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupNode[] | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError("");
      try {
        await fetch("/api/member/roadmap/init-suggested", { method: "POST" });
        const res = await fetch("/api/member/roadmap");
        const data = (await res.json()) as ApiRoadmapResponse;
        if (!res.ok || !data.ok) throw new Error("Không tải được lộ trình.");
        if (cancelled) return;
        setGroups(data.groups);
        const initial: Record<string, boolean> = {};
        for (const g of data.groups) {
          for (const l of g.levels) {
            for (const m of l.modules) {
              initial[m.id] = m.isSelected;
            }
          }
        }
        setSelection(initial);
      } catch {
        if (!cancelled) setError("Không tải được lộ trình gợi ý. Vui lòng thử lại.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => { cancelled = true; };
  }, []);

  const handleToggle = useCallback((moduleId: string, next: boolean) => {
    setSelection((prev) => ({ ...prev, [moduleId]: next }));
  }, []);

  async function handleSubmit() {
    if (!groups) return;
    setSubmitting(true);
    setError("");
    try {
      const unselectedModuleIds = Object.entries(selection)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      const res = await fetch("/api/member/roadmap/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unselectedModuleIds }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message: string } };
      if (!res.ok || !data.ok) throw new Error(data.error?.message ?? "Lỗi máy chủ");
      router.push("/lo-trinh");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được lộ trình.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-line bg-secondary/40" />
        ))}
      </div>
    );
  }

  if (error && !groups) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        {error}
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-secondary/30 px-5 py-8 text-center text-sm text-ink-3">
        <p>Chưa có bài gợi ý — hãy hoàn tất khảo sát trước.</p>
        <Link
          href="/onboarding"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground transition hover:bg-brand-2"
        >
          Vào onboarding →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Bước 1</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">
          Lộ trình gợi ý cho bạn
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Bỏ tích những bài bạn đã thạo rồi bấm{" "}
          <strong className="text-ink">Tạo lộ trình học</strong>.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <GroupSection
            key={group.slug}
            group={group}
            selection={selection}
            onToggle={handleToggle}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-8 text-base font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-2 disabled:opacity-60"
        >
          {submitting ? "Đang lưu…" : "Tạo lộ trình học →"}
        </button>
      </div>
    </div>
  );
}
