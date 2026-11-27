"use client";

// Modal video chào mừng — hiện 1 lần cho người dùng lần đầu vào hệ thống.
// Đánh dấu đã xem qua localStorage (theo user) để không hiện lại.
// Chỉ mount cho nhân viên (xem (app)/layout); manager/operator không thấy.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// ID video YouTube giới thiệu. Đổi tại đây nếu cần thay video.
const WELCOME_VIDEO_ID = "PNWtY5Lda08";
const SEEN_KEY_PREFIX = "welcome-video-seen:";

export function WelcomeVideoModal({ userKey }: { userKey: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldShowWelcomeVideoOnPath(pathname)) {
      return;
    }

    try {
      const key = SEEN_KEY_PREFIX + userKey;
      if (!localStorage.getItem(key)) {
        // Sync 1 lần với localStorage sau hydrate (tránh mismatch SSR) — không phải cascading thật.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpen(true);
      }
    } catch {
      // localStorage không khả dụng → bỏ qua, không chặn app.
    }
  }, [pathname, userKey]);

  function close() {
    try {
      localStorage.setItem(SEEN_KEY_PREFIX + userKey, new Date().toISOString());
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open || !shouldShowWelcomeVideoOnPath(pathname)) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Video chào mừng"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Chào mừng bạn đến với AI Trợ Lý 👋
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="grid h-9 w-9 flex-none place-items-center rounded-full border border-line text-ink-2 transition hover:border-brand hover:text-brand"
          >
            ✕
          </button>
        </div>
        <div className="relative aspect-video w-full bg-black">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${WELCOME_VIDEO_ID}?rel=0`}
            title="Video chào mừng AI Trợ Lý"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex justify-end px-5 py-4">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-brand-foreground shadow-md transition hover:bg-brand-2"
          >
            Bắt đầu →
          </button>
        </div>
      </div>
    </div>
  );
}

export function shouldShowWelcomeVideoOnPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}
