"use client";

// Màn 5 tier (FE-15 + Phase-3). Gom bài đã chọn theo tier, accordion 1→5.
// Tier mở: bấm bài để học + bài kiểm tra cổng ở cuối. Tier khoá: phủ mờ + 🔒.
// Tier 5 (Master+) render bình thường như các tier khác; hiện badge L4/L5 + prerequisite mềm.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildTierViews,
  getModuleCategoryLabel,
  isFreeAccessRole,
  isModulePaywalled,
  LEARNING_TIERS,
  type Tier,
  type TierGateInput,
} from "@/lib/learning-tiers";
import { getRole } from "@/lib/roles";

type ModuleMeta = { title: string; durationMin: number; level?: number };

// Badge màu cho tier (tier 5 = gradient đặc biệt).
function TierBadge({ tier }: { tier: Tier }) {
  const info = LEARNING_TIERS.find((t) => t.id === tier);
  if (!info) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${info.color}`}>
      Lvl {tier} · {info.label}
    </span>
  );
}

// Badge cấp độ module (L4/L5) — chỉ hiện khi level ≥ 4.
function LevelBadge({ level }: { level?: number }) {
  if (!level || level < 4) return null;
  const label = level === 5 ? "L5 · Master+" : "L4";
  const cls = level === 5
    ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white"
    : "bg-rose-100 text-rose-700";
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

// Gom danh sách bài (đã sắp theo độ khó) theo NHÓM VIỆC, giữ số thứ tự liên tục.
function groupByCategory(moduleIds: string[]) {
  const groups: { label: string; items: { id: string; order: number }[] }[] = [];
  moduleIds.forEach((id, i) => {
    const label = getModuleCategoryLabel(id);
    let g = groups.find((x) => x.label === label);
    if (!g) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push({ id, order: i + 1 });
  });
  return groups;
}

export function LoTrinhTiers({
  roleId,
  input,
  learningActivated = true,
  trialAllowedModuleIds = null,
}: {
  roleId: string;
  input: TierGateInput;
  // Freemium gate (Phase 0): false → khoá mềm bài ngoài FREE_MODULE_NUMS.
  learningActivated?: boolean;
  // Admin trial whitelist (PR #28): khi set, chỉ bài trong list được mở; rỗng → không áp.
  trialAllowedModuleIds?: string[] | null;
}) {
  const role = getRole(roleId);
  const views = useMemo(() => {
    const rawViews = buildTierViews(roleId, input);
    return rawViews.map((view) => ({
      ...view,
      groupedCategories: groupByCategory(view.moduleIds),
    }));
  }, [roleId, input]);
  const trialAllowed = useMemo(() => {
    return trialAllowedModuleIds ? new Set(trialAllowedModuleIds) : null;
  }, [trialAllowedModuleIds]);
  // Mặc định mở tier đang học (tier mở đầu tiên chưa hoàn thành), fallback tier 1.
  const firstOpen =
    views.find((v) => v.unlocked && !(v.allModulesDone && v.gatePassed))?.tier ??
    views[0]?.tier ??
    1;
  const [open, setOpen] = useState<number>(firstOpen);

  if (!role) return null;

  const metaById = new Map<string, ModuleMeta>(
    role.modules.map((m) => [m.id, { title: m.title, durationMin: m.durationMin, level: m.level }]),
  );

  return (
    <div className="space-y-3">
      {views.map((view) => {
        const isOpen = open === view.tier;
        return (
          <div
            key={view.tier}
            className={`overflow-hidden rounded-2xl border ${
              view.unlocked ? "border-line bg-card" : "border-line bg-secondary/40"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : view.tier)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left"
            >
              <span
                className={`grid h-10 w-10 flex-none place-items-center rounded-xl font-display text-base font-extrabold ${
                  view.unlocked
                    ? "bg-brand text-brand-foreground"
                    : "bg-line text-ink-3"
                }`}
              >
                {view.unlocked ? view.tier : "🔒"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-display text-base font-bold text-ink">
                    Khối {view.tier} · {view.label}
                  </p>
                  {view.tier >= 5 && <TierBadge tier={view.tier as Tier} />}
                </div>
                <p className="mt-0.5 text-xs text-ink-2">
                  {view.unlocked
                    ? `${view.completed}/${view.total} bài · ${view.percent}% hoàn thành`
                    : "Hoàn thành khối trước để mở"}
                </p>
              </div>
              {view.unlocked && (
                <span className="text-ink-3">{isOpen ? "▲" : "▼"}</span>
              )}
            </button>

            {isOpen && view.unlocked && (
              <div className="border-t border-line px-4 py-3">
                {/* Badge đề xuất thứ tự — prerequisite mềm, không khoá cứng */}
                {view.tier >= 4 && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span className="mt-0.5 flex-none">💡</span>
                    <span>
                      <strong>Đề xuất:</strong> nên hoàn thành Khối {view.tier - 1} trước để học tốt hơn.
                      Bạn vẫn có thể học bài này ngay nếu muốn.
                    </span>
                  </div>
                )}
                {/* Trong mỗi tier (độ khó), gom tiếp theo NHÓM VIỆC liên quan. */}
                {view.groupedCategories.map((group) => (
                  <div key={group.label} className="mb-3 last:mb-0">
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                      {group.label}
                    </p>
                    <ul className="space-y-2">
                      {group.items.map(({ id, order }) => {
                        const meta = metaById.get(id);
                        const status = input.progress[id] ?? "chua-hoc";
                        const done = status === "hoan-thanh";
                        // Compose 2 gate: Phase-0 freemium + PR #28 admin trial whitelist.
                        // Bị khoá nếu EITHER mechanism trigger. Khóa học miễn phí
                        // (vd vibe-code) bỏ qua toàn bộ gate → không hiện 🔒.
                        const paywalled =
                          !isFreeAccessRole(roleId) &&
                          (isModulePaywalled(id, learningActivated) ||
                            Boolean(trialAllowed && !trialAllowed.has(id)));
                        return (
                          <li key={id}>
                            {paywalled ? (
                              <div className="relative flex items-center gap-3 rounded-xl border border-dashed border-line bg-secondary/40 p-3 opacity-80">
                                <span className="grid h-8 w-8 flex-none place-items-center rounded-full border-2 border-line bg-card text-sm text-ink-3">
                                  🔒
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <p className="truncate text-sm font-semibold text-ink-2">
                                      {meta?.title ?? id}
                                    </p>
                                    <LevelBadge level={meta?.level} />
                                  </div>
                                  <p className="text-xs text-ink-3">
                                    Học thử hết 6 bài — nâng cấp để mở khoá
                                  </p>
                                </div>
                                <Link
                                  href="/cho-kich-hoat"
                                  className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground hover:bg-accent/90"
                                >
                                  Nâng cấp
                                </Link>
                              </div>
                            ) : (
                              <Link
                                href={`/lo-trinh/${id}`}
                                className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 transition hover:border-brand/50 hover:shadow-sm"
                              >
                                <span
                                  className={`grid h-8 w-8 flex-none place-items-center rounded-full border-2 text-sm font-bold ${
                                    done
                                      ? "border-brand bg-brand text-brand-foreground"
                                      : status === "dang-hoc"
                                        ? "border-accent text-accent"
                                        : "border-line text-ink-3"
                                  }`}
                                >
                                  {done ? "✓" : order}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <p className="truncate text-sm font-semibold text-ink">
                                      {meta?.title ?? id}
                                    </p>
                                    <LevelBadge level={meta?.level} />
                                  </div>
                                  <p className="text-xs text-ink-3">
                                    ⏱ {meta?.durationMin ?? 0} phút ·{" "}
                                    {done
                                      ? "Hoàn thành"
                                      : status === "dang-hoc"
                                        ? "Đang học"
                                        : "Chưa học"}
                                  </p>
                                </div>
                                <span className="hidden text-ink-3 sm:inline">→</span>
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

                <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        Bài kiểm tra cổng — {view.label}
                      </p>
                      <p className="text-xs text-ink-2">
                        {view.gatePassed
                          ? "✓ Đã đạt (≥70%)"
                          : view.allModulesDone
                            ? "Hoàn thành hết bài rồi — làm bài kiểm tra để mở khối sau."
                            : "Học hết bài trong khối rồi mới nên làm bài kiểm tra cổng."}
                      </p>
                    </div>
                    <Link
                      href={`/kiem-tra/${roleId}?tier=${view.tier}`}
                      className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
                        view.gatePassed
                          ? "border-2 border-line bg-card text-ink-2 hover:border-brand"
                          : "bg-accent text-accent-foreground hover:bg-accent/90"
                      }`}
                    >
                      {view.gatePassed ? "Làm lại" : "Làm bài kiểm tra →"}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
