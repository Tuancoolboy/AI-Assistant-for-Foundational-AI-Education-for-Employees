// Client helper: gọi route AI chấm level với timeout + fallback heuristic.
// Tách khỏi component để giữ onboarding-flow gọn và dễ test.

import type { AiLevelSignals } from "./assessment-level-agent";

export type AiLevelInfo = {
  level: number; // 1-5
  levelLabel: string;
  levelDesc: string;
  source: "agent" | "heuristic";
};

const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Gọi /api/agent/assessment-level. Lỗi mạng / timeout / non-OK → trả null để
 * caller tự fallback về heuristic (không chặn luồng onboarding).
 */
export async function classifyAiLevelViaApi(
  signals: AiLevelSignals,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AiLevelInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/agent/assessment-level", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signals),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: AiLevelInfo } | AiLevelInfo;
    const data = "data" in json && json.data ? json.data : (json as AiLevelInfo);
    if (typeof data?.level !== "number") return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
