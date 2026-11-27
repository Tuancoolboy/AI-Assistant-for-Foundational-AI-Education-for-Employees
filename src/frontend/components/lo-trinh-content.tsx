"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentPathPanel } from "@/components/agent-path-panel";
import { LearningEncouragementCard } from "@/components/learning-encouragement-card";
import { RoadmapTree } from "@/components/roadmap-tree";
import { LoTrinhPageSkeleton } from "@/components/skeletons/page-skeletons";
import { copyTextToClipboard } from "@/lib/clipboard";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { getDemoProfile } from "@/lib/demo-storage";
import { getRole } from "@/lib/roles";
import {
  getEmployeeProfile,
  getEmployeeExtraLessons,
} from "@/lib/supabase/employee";
import type { ExtraSkillLessonView } from "@/lib/extra-skill-lessons";

// Cờ tạm ẩn block "Lộ trình AI gợi ý cho bạn" (AgentPathPanel). Đặt true để bật lại.
const SHOW_AGENT_PATH_PANEL = false;

export function LoTrinhContent() {
  const [profile, setProfile] = useState<ReturnType<typeof getDemoProfile>>(null);
  const [extraLessons, setExtraLessons] = useState<ExtraSkillLessonView[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErrorMessage("");
      try {
        let prof = getDemoProfile();
        const extra: ExtraSkillLessonView[] = [];

        if (isSupabaseConfigured()) {
          const [nextProfile, nextExtra] = await Promise.all([
            getEmployeeProfile(),
            getEmployeeExtraLessons().catch(() => [] as ExtraSkillLessonView[]),
          ]);
          prof = nextProfile;
          if (!cancelled) setExtraLessons(nextExtra);
        } else {
          if (!cancelled) setExtraLessons(extra);
        }

        if (cancelled) return;
        setProfile(prof);
      } catch (err) {
        console.warn("[lo-trinh] Không đọc được dữ liệu Supabase:", err);
        if (!cancelled) {
          setErrorMessage("Chưa đọc được dữ liệu Supabase. Vui lòng tải lại.");
          setProfile(getDemoProfile());
          setExtraLessons([]);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) {
    // Skeleton đầy đủ (như loading.tsx) thay vì 1 thanh trống → bỏ cảnh "trắng
    // lúc client tự fetch lộ trình".
    return <LoTrinhPageSkeleton />;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">
          Hoàn thành onboarding trước
        </h1>
        <p className="mt-3 text-ink-2">
          Bạn cần chọn vai trò + làm bài đánh giá để có lộ trình cá nhân hóa.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-brand px-7 text-base font-semibold text-brand-foreground transition hover:bg-brand-2"
        >
          Vào onboarding →
        </Link>
      </div>
    );
  }

  const role = getRole(profile.roleId);
  if (!role) {
    console.warn("[lo-trinh] getRole() trả về null cho roleId:", profile.roleId);
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">
          Lộ trình đang được chuẩn bị
        </h1>
        <p className="mt-3 text-ink-2">
          Hoàn tất onboarding để có lộ trình cá nhân hóa theo vai trò.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-brand px-7 text-base font-semibold text-brand-foreground transition hover:bg-brand-2"
        >
          Vào onboarding →
        </Link>
      </div>
    );
  }
  const aiLevel = profile.assessment?.aiLevel ?? 0;
  const hasExtraLessons = extraLessons.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 md:py-14">
      {errorMessage && (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {errorMessage}
        </div>
      )}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-2 p-5 text-brand-foreground shadow-md sm:rounded-3xl sm:p-7 md:p-9">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Lộ trình của anh/chị · {role.shortLabel}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Hành trình AI của bạn
          </h1>
          <p className="mt-2 text-sm text-brand-foreground/80">
            {aiLevel >= 5
              ? "Đã skip module cơ bản. Bắt đầu với use case nâng cao."
              : `Trình độ AI hiện tại: ${profile.assessment?.levelLabel ?? "—"}`}
          </p>
        </div>
      </div>

      {/* Tạm ẩn block "Lộ trình AI gợi ý cho bạn" (AgentPathPanel) — trùng với
          lộ trình đã chốt bên dưới. Bật lại bằng cờ SHOW_AGENT_PATH_PANEL=true.
          Chỗ này thay bằng thẻ "Lời nhắn động viên". */}
      <div className="mt-8">
        {SHOW_AGENT_PATH_PANEL ? <AgentPathPanel /> : <LearningEncouragementCard />}
      </div>

      <div className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              Bộ khởi đầu nhanh
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">
              Prompt mẫu copy-dùng-ngay
            </h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {role.starterKit.prompts.map((prompt) => (
            <PromptCard key={prompt.title} title={prompt.title} prompt={prompt.prompt} />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Công cụ AI dành cho bạn
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink">
          {role.starterKit.tools.length} công cụ gợi ý
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {role.starterKit.tools.map((tool) => (
            <div
              key={tool.name}
              className="rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 flex-none place-items-center rounded-xl font-display text-lg font-extrabold text-white"
                  style={{ backgroundColor: tool.color }}
                >
                  {tool.name.charAt(0)}
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-ink">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-ink-2">{tool.desc}</p>
                </div>
              </div>
              <p className="mt-3 rounded-xl border border-line-2 bg-secondary/50 px-3 py-2 text-xs text-ink-2">
                <strong className="text-brand">Dùng cho:</strong> {tool.useFor}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              Lộ trình kỹ năng
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">
              Lộ trình học của bạn
            </h2>
          </div>
          <Link
            href={`/kiem-tra/${profile.roleId}`}
            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 sm:w-auto"
          >
            Làm bài kiểm tra →
          </Link>
        </div>

        <div className="mt-4">
          <RoadmapTree />
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              Kỹ năng khác
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">
              Bài học thêm đã lưu
            </h2>
          </div>
          <p className="text-xs text-ink-3">
            Tối đa 5 bài học thêm cho mỗi người
          </p>
        </div>

        {hasExtraLessons ? (
          <ul className="mt-4 space-y-2">
            {extraLessons.map((lesson) => (
              <li key={lesson.moduleId}>
                <Link
                  href={`/lo-trinh/${lesson.moduleId}`}
                  className="flex w-full items-center gap-4 rounded-2xl border border-line bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-brand bg-brand-soft text-brand">
                    ✦
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {lesson.title || lesson.moduleId}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-2">
                      <span>{lesson.skillLabel}</span>
                      <span className="text-ink-3">·</span>
                      <span>{lesson.roleLabel}</span>
                      <span className="text-ink-3">·</span>
                      <span
                        className={
                          lesson.status === "hoan-thanh"
                            ? "font-semibold text-brand"
                            : lesson.status === "dang-hoc"
                              ? "font-semibold text-accent"
                              : "text-ink-3"
                        }
                      >
                        {lesson.status === "hoan-thanh"
                          ? "Đã xong"
                          : lesson.status === "dang-hoc"
                            ? "Đang học"
                            : "Chưa học"}
                      </span>
                    </div>
                  </div>
                  <span className="hidden text-ink-3 sm:inline">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-secondary/30 p-5 text-sm text-ink-3">
            Chưa có bài kỹ năng khác nào được lưu.
          </div>
        )}
      </div>
    </div>
  );
}

function PromptCard({ title, prompt }: { title: string; prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyTextToClipboard(prompt);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:shadow-md">
      <h3 className="font-display text-base font-bold text-ink">{title}</h3>
      <p className="mt-2 line-clamp-4 flex-1 text-xs text-ink-2">{prompt}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-brand bg-card px-4 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-soft"
      >
        {copied ? "✓ Đã copy" : "📋 Copy prompt"}
      </button>
    </div>
  );
}
