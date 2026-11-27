"use client";

// Trang "Bộ kỹ năng cá nhân" (FE-16). Liệt kê skill đã lưu + nút gỡ + empty state.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchSavedSkills,
  removeSavedSkill,
  type SavedSkill,
} from "@/lib/client-api";
import { getLearningModuleById } from "@/lib/learning-modules-data";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export function BoKyNangContent() {
  const [skills, setSkills] = useState<SavedSkill[]>([]);
  // Demo mode (không Supabase) coi như đã hydrate sẵn → tránh setState trong effect.
  const [hydrated, setHydrated] = useState(() => !isSupabaseConfigured());
  const [errorMessage, setErrorMessage] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    void fetchSavedSkills()
      .then((res) => {
        if (!cancelled) setSkills(res.skills);
      })
      .catch((err) => {
        console.warn("[bo-ky-nang]", err);
        if (!cancelled) setErrorMessage("Chưa đọc được bộ kỹ năng. Tải lại trang.");
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRemove(skillId: string) {
    setRemovingId(skillId);
    try {
      await removeSavedSkill(skillId);
      setSkills((prev) => prev.filter((s) => s.skillId !== skillId));
    } catch (err) {
      console.warn("[bo-ky-nang:remove]", err);
      setErrorMessage("Chưa gỡ được kỹ năng. Thử lại.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 md:py-14">
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-2 p-6 text-brand-foreground shadow-md sm:rounded-3xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Bộ kỹ năng của tôi
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
          Kỹ năng AI đã lưu
        </h1>
        <p className="mt-2 text-sm text-brand-foreground/85">
          Học xong một bài, bấm <b>Lưu skill</b> để giữ kỹ năng vào đây.
        </p>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {errorMessage}
        </div>
      )}

      {!hydrated ? (
        <div className="mt-8 h-24 animate-pulse rounded-2xl bg-secondary" />
      ) : skills.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-secondary/30 p-8 text-center">
          <p className="text-sm text-ink-2">
            Chưa lưu kỹ năng nào — học xong một bài và bấm{" "}
            <b>Lưu skill</b>.
          </p>
          <Link
            href="/lo-trinh"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-2"
          >
            Vào lộ trình →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {skills.map((skill) => {
            const sourceTitle = skill.sourceModuleId
              ? getLearningModuleById(skill.sourceModuleId)?.title ?? null
              : null;
            return (
              <li
                key={skill.skillId}
                className="flex items-start gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm"
              >
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-soft text-lg text-brand">
                  🎯
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold text-ink">
                    {skill.name}
                  </p>
                  {skill.description && (
                    <p className="mt-0.5 text-sm text-ink-2">
                      {skill.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-3">
                    {sourceTitle ? `Từ bài: ${sourceTitle}` : "Đã lưu"}
                    {" · "}
                    {new Date(skill.savedAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemove(skill.skillId)}
                  disabled={removingId === skill.skillId}
                  className="flex-none rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-3 transition hover:border-destructive hover:text-destructive disabled:opacity-50"
                >
                  {removingId === skill.skillId ? "Đang gỡ..." : "Gỡ"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
