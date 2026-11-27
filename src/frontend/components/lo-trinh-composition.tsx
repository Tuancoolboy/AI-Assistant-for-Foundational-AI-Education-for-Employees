"use client";

// Bước chọn bài & chốt lộ trình (FE-15 §7). Lộ trình gợi ý (tích sẵn) + kỹ năng khác
// (bỏ tích). Giới hạn số bài = `maxSelection` từ server (MAX_SELECTION, hiện 999 =
// chưa giới hạn cho tệp khách đang chạy; sẽ cấu hình ngưỡng thật sau). Bấm
// "Xác nhận lộ trình" → chốt 1 lần.

import { useMemo, useState } from "react";
import { confirmLearningPath } from "@/lib/client-api";
import {
  buildTierMapFromModules,
  getModuleTier,
  tierLabel,
} from "@/lib/learning-tiers";
import type { LearningModuleRecord } from "@/lib/learning-modules-data";
import { getRole } from "@/lib/roles";

type ModuleOption = {
  id: string;
  title: string;
  durationMin: number;
  tierName: string;
};

export function LoTrinhComposition({
  roleId,
  levelLabel,
  aiLevel = 0,
  maxSelection,
  suggestedModuleIds,
  modules = [],
  onConfirmed,
}: {
  roleId: string;
  levelLabel: string | null;
  aiLevel?: number;
  maxSelection: number;
  suggestedModuleIds: string[];
  // Module thật từ DB (đủ 64 bài). Rỗng → fallback static roles.ts (56 bài).
  modules?: LearningModuleRecord[];
  onConfirmed: () => void;
}) {
  const role = getRole(roleId);

  // Bước: trước hết hiện kết quả level (FE-15 §4 / yêu cầu thứ tự), rồi mới chọn bài.
  const [showPicker, setShowPicker] = useState(false);

  const { suggested, extra } = useMemo(() => {
    // Nguồn bài: ưu tiên DB (64 bài) để không rớt m57–m64; fallback static khi DB rỗng.
    const source: ModuleOption[] =
      modules.length > 0
        ? (() => {
            const tierMap = buildTierMapFromModules(
              modules.map((m) => ({ id: m.id, level: m.level })),
            );
            return modules.map((m) => ({
              id: m.id,
              title: m.title,
              durationMin: m.duration_min,
              tierName: tierLabel(tierMap[m.id] ?? 1),
            }));
          })()
        : (role?.modules ?? []).map((m) => ({
            id: m.id,
            title: m.title,
            durationMin: m.durationMin,
            tierName: tierLabel(getModuleTier(m.id)),
          }));
    const suggestedSet = new Set(suggestedModuleIds);
    return {
      suggested: source.filter((m) => suggestedSet.has(m.id)),
      extra: source.filter((m) => !suggestedSet.has(m.id)),
    };
  }, [role, modules, suggestedModuleIds]);

  // Tích sẵn theo danh sách bài gợi ý THẬT SỰ hiển thị (đã giao với kho bài
  // publish), KHÔNG theo suggestedModuleIds thô — tránh đếm cả id không render
  // được (số "đã tích" lệch với số dòng + số báo ở onboarding/teaser).
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggested.map((m) => m.id)),
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const atCap = selected.size >= maxSelection;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= maxSelection) return prev; // chặn cứng
        next.add(id);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) {
      setErrorMessage("Hãy chọn ít nhất 1 bài.");
      return;
    }
    setSaving(true);
    setErrorMessage("");
    try {
      await confirmLearningPath([...selected]);
      onConfirmed();
    } catch (err) {
      console.warn("[lo-trinh-composition] confirm:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Chưa chốt được lộ trình. Thử lại.",
      );
      setSaving(false);
    }
  }

  if (!role) return null;

  // Màn kết quả level — hiện TRƯỚC bước tạo khóa (chọn bài). Bấm "Tiếp tục" mới sang picker.
  if (!showPicker) {
    const levelPct = Math.max(0, Math.min(5, aiLevel)) / 5;
    const suggestedCount = suggested.length;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12 md:py-14">
        <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Kết quả đánh giá
        </p>
        <h1 className="mt-3 text-center font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Trình độ AI hiện tại của bạn
        </h1>
        <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-card shadow-md">
          <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-brand to-brand-2 p-7 text-brand-foreground">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
                Bạn đang ở
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                Level {levelLabel ?? aiLevel}
              </p>
              <p className="mt-2 text-sm text-brand-foreground/85">
                Tiếp theo, hãy chọn các bài học để tạo lộ trình 4 khối dành riêng cho bạn.
              </p>
            </div>
            <div className="relative grid h-24 w-24 flex-none place-items-center">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - levelPct)}
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute font-display text-2xl font-bold">{aiLevel}/5</span>
            </div>
          </div>
          <div className="p-7">
            <p className="text-sm text-ink-2">
              Hệ thống đã gợi ý sẵn{" "}
              <span className="font-semibold text-brand">{suggestedCount} bài</span>{" "}
              phù hợp với trình độ của bạn. Bạn có thể tích thêm «Kỹ năng khác» ở bước sau.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-8 text-base font-semibold text-accent-foreground shadow-md transition hover:bg-accent/90 hover:-translate-y-0.5"
        >
          Tiếp tục — chọn bài học →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 md:py-14">
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-2 p-6 text-brand-foreground shadow-md sm:rounded-3xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Chọn bài & chốt lộ trình · {role.shortLabel}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
          Tạo lộ trình học của riêng bạn
        </h1>
        <p className="mt-2 text-sm text-brand-foreground/85">
          Chọn các bài bạn muốn học. Sau khi xác nhận sẽ không đổi được, nên hãy
          cân nhắc kỹ.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-sm">
        <span className="font-semibold text-ink">
          Đã chọn <span className="text-brand">{selected.size}</span> bài
        </span>
      </div>

      <section className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Lộ trình gợi ý dành cho bạn
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-bold text-ink">
            Bài nên học trước
          </h2>
          {levelLabel && (
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              Level {levelLabel}
            </span>
          )}
        </div>
        {suggested.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {suggested.map((m) => (
              <ModuleCheckbox
                key={m.id}
                option={m}
                checked={selected.has(m.id)}
                disabled={!selected.has(m.id) && atCap}
                onToggle={() => toggle(m.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-line bg-secondary/30 p-4 text-sm text-ink-3">
            Chưa có gợi ý riêng — hãy chọn từ danh sách kỹ năng bên dưới.
          </p>
        )}
      </section>

      {extra.length > 0 && (
        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Kỹ năng khác
          </p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink">
            Tích thêm nếu muốn học
          </h2>
          <ul className="mt-4 space-y-2">
            {extra.map((m) => (
              <ModuleCheckbox
                key={m.id}
                option={m}
                checked={selected.has(m.id)}
                disabled={!selected.has(m.id) && atCap}
                onToggle={() => toggle(m.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="sticky bottom-0 mt-8 flex flex-col items-end gap-2 bg-gradient-to-t from-background via-background/95 to-transparent py-4">
        {errorMessage && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || selected.size === 0}
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-8 text-base font-semibold text-brand-foreground shadow-md transition hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Đang chốt..." : `Xác nhận lộ trình (${selected.size} bài)`}
        </button>
      </div>
    </div>
  );
}

function ModuleCheckbox({
  option,
  checked,
  disabled,
  onToggle,
}: {
  option: ModuleOption;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${
          checked
            ? "border-brand bg-brand-soft"
            : disabled
              ? "border-line bg-card/50 opacity-50"
              : "border-line bg-card hover:border-brand/40"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="h-5 w-5 flex-none accent-[var(--brand)]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{option.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-2">
            <span>⏱ {option.durationMin} phút</span>
            <span className="text-ink-3">·</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              {option.tierName}
            </span>
          </div>
        </div>
      </label>
    </li>
  );
}
