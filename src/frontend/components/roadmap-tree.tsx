"use client";

// Cây lộ trình READ-ONLY — chỉ hiển thị bài đã chọn (isSelected===true).
// Không có checkbox / store / PATCH. Dùng sau khi user xác nhận lộ trình.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

// ---------- Status badge ----------

function StatusBadge({ status }: { status: ModuleStatus }) {
  if (status === "hoan-thanh") {
    return <span className="whitespace-nowrap text-xs font-semibold text-brand">● Hoàn thành</span>;
  }
  if (status === "dang-hoc") {
    return <span className="whitespace-nowrap text-xs font-semibold text-accent">◐ Đang học</span>;
  }
  return <span className="whitespace-nowrap text-xs text-ink-3">○ Chưa học</span>;
}

// ---------- Group accordion (read-only) ----------

function GroupAccordion({ group }: { group: GroupNode }) {
  const selectedModules = group.levels.flatMap((l) =>
    l.modules.filter((m) => m.isSelected),
  );
  const selectedCount = selectedModules.length;
  // Badge hiển thị "đã hoàn thành / tổng bài trong lộ trình" — không phải tổng/tổng.
  const completedCount = selectedModules.filter(
    (m) => m.status === "hoan-thanh",
  ).length;

  return (
    <details className="rounded-2xl border border-line bg-card shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 select-none">
        <span className="font-display text-base font-bold text-ink">{group.label}</span>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-ink-2">
            {completedCount}/{selectedCount} bài · {group.percent}%
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
        {selectedCount === 0 ? (
          <p className="pt-2 text-xs text-ink-3">Không có bài đang theo dõi</p>
        ) : (
          group.levels
            .filter((l) => l.modules.some((m) => m.isSelected))
            .map((level) => (
              <div key={level.level} className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">
                  {level.label}
                </p>
                <ul className="space-y-2">
                  {level.modules
                    .filter((m) => m.isSelected)
                    .map((mod) => (
                      <li
                        key={mod.id}
                        className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:border-brand/40 hover:shadow-sm"
                      >
                        <Link
                          href={`/lo-trinh/${mod.id}`}
                          className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline"
                        >
                          {mod.title}
                        </Link>
                        <StatusBadge status={mod.status} />
                      </li>
                    ))}
                </ul>
              </div>
            ))
        )}
      </div>
    </details>
  );
}

// ---------- Public component ----------

export function RoadmapTree() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/member/roadmap");
        const data = (await res.json()) as ApiRoadmapResponse;
        if (!res.ok || !data.ok) throw new Error("Không tải được lộ trình.");
        if (!cancelled) setGroups(data.groups);
      } catch {
        if (!cancelled) setError("Không tải được lộ trình. Vui lòng thử lại.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-line bg-secondary/40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        {error}
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-secondary/30 px-5 py-8 text-center text-sm text-ink-3">
        Bạn chưa có nhóm kỹ năng nào trong lộ trình.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => router.push("/lo-trinh/goi-y")}
          className="inline-flex h-9 items-center justify-center rounded-full border-2 border-brand bg-card px-5 text-sm font-semibold text-brand transition hover:bg-brand-soft"
        >
          Chỉnh lộ trình
        </button>
      </div>
      {groups.map((group) => (
        <GroupAccordion key={group.slug} group={group} />
      ))}
    </div>
  );
}
