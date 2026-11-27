// AI level classifier — gọi OpenAI với CHỈ tín hiệu chuẩn hóa (không PII, không questionId).
// Thêm/sửa câu hỏi trong assessment-hr.ts không ảnh hưởng đến logic ở đây.
// Lỗi / thiếu key / parse fail / timeout → fallback heuristic (không crash flow).

import { getOpenAIClient, getOpenAIModel, isOpenAIConfigured } from "@/lib/openai";
import { clampLevel1to5 } from "@/lib/assessment";

/** Tín hiệu chuẩn hóa — KHÔNG chứa questionId, không PII. */
export type AiLevelSignals = {
  aiFrequencyScore: number;   // 0–6 (từ tần suất dùng AI)
  promptSkillScore: number;   // 0–7 (từ kỹ năng viết prompt)
  aiToolsCount: number;       // 0–8 (số công cụ AI đã dùng)
  aiForHrCount: number;       // 0–4 (số việc HR đã dùng AI)
  dataSafetyScore: number;    // 0–4 (hiểu an toàn dữ liệu)
  heuristicLevel: number;     // 1–5 (level từ heuristic calculateResult)
};

export type AiLevelResult = {
  level: number;        // 1–5
  levelLabel: string;
  levelDesc: string;
  source: "agent" | "heuristic";
};

const LEVEL_META: Record<number, { label: string; desc: string }> = {
  1: { label: "Mới bắt đầu", desc: "Chưa quen với AI — lộ trình đi từ cơ bản, dễ áp dụng ngay." },
  2: { label: "Làm quen", desc: "Đã thử AI 1–2 lần — tập trung dùng AI cho công việc thực tế." },
  3: { label: "Cơ bản", desc: "Dùng AI khá ổn — lộ trình nâng lên use case nâng cao hơn." },
  4: { label: "Khá quen tay", desc: "Dùng AI thường xuyên — học tối ưu prompt + công cụ chuyên sâu." },
  5: { label: "Thành thạo", desc: "Dùng AI tốt — tập trung use case chuyên sâu & quy trình tự động." },
};

function buildPrompt(s: AiLevelSignals): string {
  return `Bạn là hệ thống chấm level AI cho nhân viên HR Việt Nam (thang 1–5).

DỮ LIỆU ĐẦU VÀO (điểm tổng hợp, không có PII):
- Tần suất dùng AI: ${s.aiFrequencyScore}/6
- Kỹ năng viết prompt: ${s.promptSkillScore}/7
- Số công cụ AI đã dùng: ${s.aiToolsCount}
- Số việc HR đã dùng AI: ${s.aiForHrCount}/4
- Hiểu an toàn dữ liệu: ${s.dataSafetyScore}/4
- Level heuristic hiện tại: ${s.heuristicLevel}/5

THANG ĐÁNH GIÁ:
1 = Chưa dùng AI, không biết prompt
2 = Đã thử vài lần, biết cơ bản
3 = Dùng thỉnh thoảng, viết được prompt cơ bản
4 = Dùng thường xuyên, biết tối ưu prompt
5 = Dùng hằng ngày, thành thạo, đã áp dụng cho HR

TRẢ VỀ JSON đúng cấu trúc (không giải thích thêm):
{"level": <số nguyên 1-5>, "reason": "<1 câu lý do ngắn tiếng Việt>"}`;
}

/** Classify AI level từ normalized signals. Fallback → heuristicLevel nếu có lỗi. */
export async function classifyAiLevel(signals: AiLevelSignals): Promise<AiLevelResult> {
  if (!isOpenAIConfigured()) {
    return heuristicResult(signals.heuristicLevel);
  }

  const client = getOpenAIClient();
  if (!client) return heuristicResult(signals.heuristicLevel);

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Trả về JSON hợp lệ." },
        { role: "user", content: buildPrompt(signals) },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return heuristicResult(signals.heuristicLevel);

    let parsed: { level?: unknown };
    try {
      parsed = JSON.parse(content) as { level?: unknown };
    } catch {
      return heuristicResult(signals.heuristicLevel);
    }

    const rawLevel = Number(parsed.level);
    if (!Number.isFinite(rawLevel)) return heuristicResult(signals.heuristicLevel);

    const level = clampLevel1to5(rawLevel);
    const meta = LEVEL_META[level] ?? LEVEL_META[1];
    return { level, levelLabel: meta.label, levelDesc: meta.desc, source: "agent" };
  } catch {
    // timeout, network error, quota — fallback silently
    return heuristicResult(signals.heuristicLevel);
  }
}

function heuristicResult(raw: number): AiLevelResult {
  const level = clampLevel1to5(raw);
  const meta = LEVEL_META[level] ?? LEVEL_META[1];
  return { level, levelLabel: meta.label, levelDesc: meta.desc, source: "heuristic" };
}
