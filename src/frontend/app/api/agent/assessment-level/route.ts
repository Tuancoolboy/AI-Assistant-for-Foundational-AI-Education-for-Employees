// Route chấm AI level qua Agent — thin wrapper giống lo-trinh/route.ts.
// Client gửi normalized signals, không questionId, không PII.

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import { classifyAiLevel, type AiLevelSignals } from "@/lib/assessment-level-agent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await resolveApiSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }

  let body: Partial<AiLevelSignals> = {};
  try {
    body = (await request.json()) as Partial<AiLevelSignals>;
  } catch {
    // body rỗng → dùng giá trị mặc định
  }

  // Validate và cung cấp default để không crash classifyAiLevel
  const signals: AiLevelSignals = {
    aiFrequencyScore: toNum(body.aiFrequencyScore, 0),
    promptSkillScore: toNum(body.promptSkillScore, 0),
    aiToolsCount: toNum(body.aiToolsCount, 0),
    aiForHrCount: toNum(body.aiForHrCount, 0),
    dataSafetyScore: toNum(body.dataSafetyScore, 0),
    heuristicLevel: toNum(body.heuristicLevel, 1),
  };

  try {
    const result = await classifyAiLevel(signals);
    return apiOk(result);
  } catch (err) {
    console.error("[assessment-level]", err);
    return apiError("INTERNAL_ERROR", "Không chấm được level. Thử lại sau.");
  }
}

function toNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
