"use client";

// Track phiên NHẸ qua /api/events: session_start (throttle 30') + session_end (durationMs).
// Suy thời lượng/tần suất phiên mà không đổi schema. Lỗi không chặn UX.

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/client-api";

const THROTTLE_MS = 30 * 60 * 1000;
const KEY = "ls_last_session_start";
const MIN_SESSION_MS = 3000; // bỏ phiên quá ngắn (load nhầm)

export function SessionTracker() {
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = Date.now();

    // session_start — throttle 30 phút/trình duyệt để khỏi spam.
    try {
      const last = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - last > THROTTLE_MS) {
        localStorage.setItem(KEY, String(Date.now()));
        void trackEvent("session_start");
      }
    } catch {
      // localStorage chặn → vẫn bắn 1 lần
      void trackEvent("session_start");
    }

    const sendEnd = () => {
      const durationMs = Date.now() - startRef.current;
      if (durationMs < MIN_SESSION_MS) return;
      try {
        const blob = new Blob(
          [
            JSON.stringify({
              eventName: "session_end",
              properties: { durationMs },
            }),
          ],
          { type: "application/json" },
        );
        navigator.sendBeacon?.("/api/events", blob);
        startRef.current = Date.now(); // reset để không cộng trùng nếu quay lại
      } catch {
        // bỏ qua
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") sendEnd();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", sendEnd);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", sendEnd);
    };
  }, []);

  return null;
}
