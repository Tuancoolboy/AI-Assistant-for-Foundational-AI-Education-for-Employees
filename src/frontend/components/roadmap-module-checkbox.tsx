"use client";

// Checkbox row cho 1 bài trong cây lộ trình opt-out.
// Native input[type=checkbox] — không dùng shadcn (chưa có accordion/checkbox trong components/ui).

import Link from "next/link";
import type { ModuleStatus } from "@/lib/roadmap-store";

type Props = {
  moduleId: string;
  title: string;
  isSelected: boolean;
  status: ModuleStatus;
  disabled: boolean;
  onToggle: (moduleId: string, next: boolean) => void;
};

function StatusBadge({ status }: { status: ModuleStatus }) {
  if (status === "hoan-thanh") {
    return (
      <span className="whitespace-nowrap text-xs font-semibold text-brand">
        ● Hoàn thành
      </span>
    );
  }
  if (status === "dang-hoc") {
    return (
      <span className="whitespace-nowrap text-xs font-semibold text-accent">
        ◐ Đang học
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap text-xs text-ink-3">○ Chưa học</span>
  );
}

export function RoadmapModuleCheckbox({
  moduleId,
  title,
  isSelected,
  status,
  disabled,
  onToggle,
}: Props) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 transition ${
        isSelected ? "" : "opacity-50"
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        disabled={disabled}
        onChange={(e) => onToggle(moduleId, e.target.checked)}
        aria-label={`Chọn bài: ${title}`}
        className="h-4 w-4 flex-none cursor-pointer accent-brand disabled:cursor-not-allowed"
      />
      <Link
        href={`/lo-trinh/${moduleId}`}
        className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline"
      >
        {title}
      </Link>
      <StatusBadge status={status} />
    </li>
  );
}
