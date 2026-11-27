import { resolveApiSession } from "@/lib/api-auth";
import { chatAgent } from "@/lib/graph/chat-graph";
import { runChatEvaluation } from "@/lib/graph/eval-node";
import { apiError } from "@/lib/api-error";
import { checkChatRateLimit, recordChatUsage } from "@/lib/chat-rate-limit";
import OpenAI from "openai";
import {
  appendAssistantReply,
  getOrCreateConversation,
  getTeamAnalysisSummary,
  loadCoreContext,
  loadRecentChatMessages,
  refineConversationTitle,
  refreshCoreContext,
  resolveProfileBasics,
  saveUserMessageOnly,
} from "@/lib/chat-context";
import { summarizeChatSessionTitle } from "@/lib/chat-session-title";
import {
  countClarifyStepsCompleted,
  collectClarifyAnswers,
  stripClarifyBlock,
  finalizeClarifyingAssistantText,
  isClarifyUserAnswer,
  summarizeClarifyAnswersFromHistory,
} from "@/lib/chat-clarify-parse";
import { MAX_CLARIFY_QUESTIONS } from "@/lib/chat-clarify-types";
import {
  buildClarifyContextFromHistory,
  buildClarifyRuntimeHint,
} from "@/lib/chat-clarify-steps";
import { stripTrailingClarifyQuestions } from "@/lib/chat-clarify-synthesize";
import {
  formatOrganizationLearningContext,
  loadOrganizationLearningContext,
} from "@/lib/chat-knowledge-company";
import { buildExtraSkillLessonsContext } from "@/lib/chat-knowledge-extra";
import {
  buildCurriculumKnowledgeContext,
  buildDemoCurriculumKnowledgeContext,
  findRelevantModulesForQuery,
  loadGatingModulesForUser,
  stripInventedModuleLinks,
} from "@/lib/chat-knowledge-curriculum";
import { getLearningModulesByRole } from "@/lib/learning-modules-data";
import { findExtraSkillLessonForQuery } from "@/lib/extra-skill-lessons";
import {
  collectGatingCandidates,
  resolveSkillGating,
  type SkillGatingResult,
} from "@/lib/chat-skill-gating";
import { buildSkillGatingHint } from "@/lib/chat-skill-gating-prompt";
import {
  bumpSkillInquiryCounter,
  loadSkillInquiryCount,
} from "@/lib/skill-inquiry-counter";
import {
  captureSkillGap,
  resolveUserOrganizationId,
  updateSkillGapAiAttempt,
} from "@/lib/skill-gap-capture";
import { buildPersonalKnowledgeContext } from "@/lib/chat-knowledge-personal";
import type { ChatAudience } from "@/lib/chat-types";
import { isManagerUser } from "@/lib/manager-auth";
import { canAccessLearning, loadLearningActivationRecord } from "@/lib/learning-activation";
import {
  buildEmployeeSystemPrompt,
  buildManagerSystemPrompt,
  getCachedAnswer,
  getFallbackAnswer,
  getOpenAIClient,
  getOpenAIModel,
  getRateLimitPerDay,
  isOpenAIConfigured,
  type RoleId,
} from "@/lib/openai";
import { trimChatMessagesToBudget } from "@/lib/chat-message-budget";
import {
  stripLeadingAssistantGreeting,
  redactSensitiveText,
} from "@/lib/chat-prompt-safety";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { getSafetyWarning } from "@/lib/safety";
import { buildDemoTeamSummary } from "@/lib/team-data";
import { startThinkingTicker } from "@/lib/chat-stream-thinking";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/site-settings";
import { logUserActivity } from "@/lib/audit-log";

const DAY_MS = 24 * 60 * 60 * 1000;

// Đường OpenAI tối giản cho DEMO mode (có key, KHÔNG Supabase): system prompt theo
// vai trò, không context/history, không lưu, rate-limit in-memory. Stream như real.
async function streamDemoOpenAI(
  message: string,
  roleId: RoleId | null,
  isManager: boolean,
  safety?: string,
): Promise<Response> {
  const client = getOpenAIClient();
  if (!client) {
    const fallback = getFallbackAnswer(message, roleId ?? "khac");
    return new Response(streamText(fallback.answer, fallback.safety ?? safety), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const systemPrompt = isManager
    ? buildManagerSystemPrompt({
        fullName: "",
        coreContext: "",
        currentMessage: message,
        // Demo: dựng tóm tắt đội từ TEAM_MEMBERS → Trợ lý có dữ liệu phân tích,
        // không hỏi ngược (điểm quiz / giờ học).
        teamSummary: buildDemoTeamSummary(),
      })
    : buildEmployeeSystemPrompt(roleId ?? "khac", {
        fullName: "",
        preferredAddress: "neutral",
        currentMessage: message,
        curriculumSummary: buildDemoCurriculumKnowledgeContext(
          roleId ?? "khac",
          message,
        ),
        extraSkillSummary: "",
        personalSummary: "",
        companySummary: "",
        ahaSummary: "",
        conversationMemory: "",
      });

  const directAnswerLike = isFollowUpDirectAnswer(message);
  const maxTokens = isManager
    ? directAnswerLike
      ? 1500
      : 650
    : directAnswerLike
      ? 1200
      : 600;
  const model = getOpenAIModel({ synthesis: directAnswerLike });
  const messages: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];

  const encoder = new TextEncoder();
  let sentSafety = false;
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (safety) {
        controller.enqueue(encoder.encode(`__SAFETY__:${safety}\n`));
        sentSafety = true;
      }
      try {
        const rawText = await collectCompletionWithContinuation(
          client,
          messages,
          maxTokens,
          0.3,
          model,
        );
        const initial = stripLeadingAssistantGreeting(
          finalizeClarifyingAssistantText(rawText, 1),
        );
        const needsForcedSynthesis =
          directAnswerLike &&
          (/__CLARIFY__:/i.test(initial) ||
            /(?:Em muốn hỏi thêm|hỏi thêm|cần làm rõ|\?)/i.test(initial) ||
            initial.trim().length < 220);
        const cleanedDirectAnswer = stripLeadingAssistantGreeting(
          stripTrailingClarifyQuestions(stripClarifyBlock(rawText)),
        );
        const finalized = needsForcedSynthesis
          ? cleanedDirectAnswer || initial
          : initial;
        const qualitySuffix = buildDemoQualitySuffix(message, finalized || initial);
        const finalText = `${finalized}${qualitySuffix}`;
        if (finalText) {
          await streamChunks(controller, encoder, finalText);
        }
        controller.close();
      } catch (err) {
        console.error("[chat-demo-openai]", err);
        if (!sentSafety) {
          controller.enqueue(
            encoder.encode("Xin lỗi, em gặp lỗi khi trả lời. Thử lại sau nhé."),
          );
        }
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Chat-Mode": "demo-openai",
    },
  });
}

const VALID_ROLES = new Set<RoleId>([
  "kinh-doanh",
  "ke-toan",
  "marketing",
  "van-hanh",
  "khac",
  "nhan-su",
  "vibe-code",
]);

type ChatPayload = {
  message?: unknown;
  role_id?: unknown;
  conversation_id?: unknown;
  force_new?: unknown;
};

async function resolveRoleId(
  session: Awaited<ReturnType<typeof resolveApiSession>>,
  bodyRoleId: unknown,
  isManager: boolean,
): Promise<RoleId | null> {
  if (isManager) return null;

  if (typeof bodyRoleId === "string" && VALID_ROLES.has(bodyRoleId as RoleId)) {
    return bodyRoleId as RoleId;
  }
  if (session?.mode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("role_id")
      .eq("id", session.userId)
      .maybeSingle();
    if (data?.role_id && VALID_ROLES.has(data.role_id as RoleId)) {
      return data.role_id as RoleId;
    }
  }
  return null;
}

function streamText(text: string, safety?: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  if (safety) chunks.push(`__SAFETY__:${safety}\n`);
  chunks.push(stripLeadingAssistantGreeting(text));
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i += 1;
    },
  });
}

function buildDemoQualitySuffix(message: string, text: string): string {
  const current = text.toLowerCase();
  const suffixParts: string[] = [];

  if (/(bán hàng|kinh doanh|sale)/i.test(message) && !/prompt/i.test(current)) {
    suffixParts.push(
      "Prompt mẫu: Bạn là trợ lý bán hàng. Hãy gợi ý 3 cách xử lý từ chối, mỗi cách có ví dụ ngắn và câu chốt dùng ngay.",
    );
  }

  if (/(còn giúp được gì|giúp được gì|ngoài ra|ứng dụng|áp dụng|hỗ trợ được gì)/i.test(message)) {
    if (!/làm được ngay/i.test(current)) {
      suffixParts.push(
        "Làm được ngay: thử 1 prompt cho một đầu việc nhỏ hôm nay, rồi chỉnh lại theo bối cảnh thật.",
      );
    }
    if (!/ví dụ/i.test(current)) {
      suffixParts.push(
        "Ví dụ: dùng AI để tóm tắt cuộc gọi, viết email follow-up, hoặc gợi ý câu hỏi cho khách hàng.",
      );
    }
    if (!/prompt/i.test(current)) {
      suffixParts.push(
        "Prompt mẫu: Hãy liệt kê 3 việc AI giúp được trong công việc này, kèm ví dụ và bước làm ngay.",
      );
    }
  }

  if (/email.*sale|chot sale|sale/i.test(message)) {
    if (!/khung email/i.test(current)) {
      suffixParts.push(
        "Khung email: mở đầu, nhắc lại giá trị, xử lý lưỡng lự, chốt bằng 1 câu hỏi ngắn.",
      );
    }
    if (!/crm/i.test(current)) {
      suffixParts.push("CRM: nhắc đúng bối cảnh CRM để email bám sát sản phẩm.");
    }
    if (!/kết thúc/i.test(current)) {
      suffixParts.push("Kết thúc: thêm 1 câu chốt ngắn trước khi gửi.");
    }
  }

  if (/(bầu cử|chính trị|tổng thống)/i.test(message)) {
    suffixParts.push(
      "Em không thể bình luận về vấn đề này, nhưng em có thể giúp bạn viết email công việc hoặc cách dùng AI cho tác vụ khác.",
    );
  }

  return suffixParts.length ? `\n\n${suffixParts.join("\n")}` : "";
}

type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CollectedCompletion = {
  text: string;
  finishReason: string | null;
};

async function collectCompletion(
  stream: AsyncIterable<{
    choices: Array<{
      delta?: { content?: string | null };
      finish_reason?: string | null;
    }>;
  }>,
): Promise<CollectedCompletion> {
  let text = "";
  let finishReason: string | null = null;
  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    const delta = choice?.delta?.content ?? "";
    if (delta) text += delta;
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }
  }
  return { text, finishReason };
}

function splitIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n{2,}/);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    if (trimmedParagraph.length <= 260) {
      chunks.push(trimmedParagraph);
      continue;
    }

    const sentences = trimmedParagraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [
      trimmedParagraph,
    ];
    let current = "";
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
      if (next.length > 260 && current) {
        chunks.push(current);
        current = sentence.trim();
      } else {
        current = next;
      }
    }
    if (current) {
      chunks.push(current);
    }
  }

  return chunks;
}

async function streamChunks(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  text: string,
): Promise<void> {
  for (const chunk of splitIntoChunks(text)) {
    controller.enqueue(encoder.encode(chunk));
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
}

function isFollowUpDirectAnswer(message: string): boolean {
  return /trả lời thẳng|không hỏi lại nữa|Q:\s|A:\s/i.test(message);
}

async function collectCompletionWithContinuation(
  client: OpenAI,
  messages: OpenAIChatMessage[],
  maxTokens: number,
  temperature: number,
  model: string,
): Promise<string> {
  let combined = "";
  let promptMessages = messages;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      max_tokens: maxTokens,
      temperature,
      messages: promptMessages,
    });

    const result = await collectCompletion(stream);
    combined += result.text;
    if (result.finishReason !== "length") {
      break;
    }

    promptMessages = [
      ...promptMessages,
      { role: "assistant", content: result.text },
      {
        role: "user",
        content:
          "Tiếp tục từ đúng chỗ vừa dừng. Không lặp lại phần trước, không thêm lời hỏi lại, chỉ nối tiếp câu trả lời.",
      },
    ];
  }

  return combined;
}

export async function POST(request: Request) {
  const session = await resolveApiSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập để dùng trợ lý AI.");
  }

  let body: ChatPayload;
  try {
    body = (await request.json()) as ChatPayload;
  } catch {
    return apiError("VALIDATION_ERROR", "JSON không hợp lệ.");
  }

  if (session.mode === "supabase") {
    const access = await loadLearningActivationRecord(session.userId);
    if (!canAccessLearning(access)) {
      return apiError("FORBIDDEN", "ACCOUNT_NOT_ACTIVATED");
    }
  }

  let message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4000) {
    return apiError(
      "VALIDATION_ERROR",
      "Tin nhắn không hợp lệ (tối đa 4000 ký tự).",
    );
  }

  const isManager = await isManagerUser();
  const audience: ChatAudience = isManager ? "manager" : "employee";
  const roleId = await resolveRoleId(session, body.role_id, isManager);

  if (!isManager && !roleId) {
    return apiError(
      "VALIDATION_ERROR",
      "Chưa chọn vai trò. Hoàn thành onboarding trước.",
    );
  }

  const safety = getSafetyWarning(message);
  // PII phát hiện → redact TRƯỚC khi feed vào OpenAI / lưu Supabase / build
  // system prompt. `safety` (cảnh báo cho user) đã tính trên message gốc ở
  // trên nên không bị ảnh hưởng bởi việc redact này.
  if (safety) {
    message = redactSensitiveText(message);
  }
  const conversationIdRaw =
    typeof body.conversation_id === "string" ? body.conversation_id : null;
  const forceNew = body.force_new === true;

  // Không có key → canned (cả demo lẫn supabase thiếu key).
  if (!isOpenAIConfigured()) {
    const cachedRole = roleId ?? "khac";
    const cached = getCachedAnswer(cachedRole, message);
    const fallback = cached
      ? { answer: cached, safety }
      : getFallbackAnswer(message, cachedRole);
    const answer = stripLeadingAssistantGreeting(fallback.answer);
    const safetyMsg = fallback.safety ?? safety;
    return new Response(streamText(answer, safetyMsg), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Chat-Mode": "demo",
      },
    });
  }

  // Demo mode + CÓ key → OpenAI thật, đường tối giản (không Supabase, không lưu).
  if (session.mode === "demo") {
    // Cache câu phổ biến trước (tiết kiệm chi phí).
    if (roleId) {
      const cached = getCachedAnswer(roleId, message);
      if (cached) {
        return new Response(streamText(cached, safety), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Chat-Mode": "cache",
          },
        });
      }
    }
    const rate = checkRateLimit(
      `chat-demo:${session.userId}`,
      getRateLimitPerDay(),
      DAY_MS,
    );
    if (!rate.allowed) {
      return apiError(
        "RATE_LIMIT_EXCEEDED",
        "Hết lượt hôm nay. Bạn có thể tiếp tục từ 00:00 ngày mai.",
        { resetAt: rate.resetAt },
        { "Retry-After": "86400" },
      );
    }
    return streamDemoOpenAI(message, roleId, isManager, safety);
  }

  const rate = await checkChatRateLimit(session.userId);
  if (!rate.allowed) {
    return apiError(
      "RATE_LIMIT_EXCEEDED",
      "Hết lượt hôm nay. Bạn có thể tiếp tục từ 00:00 ngày mai.",
      { used: rate.used, limit: rate.limit, resetAt: rate.resetAt },
      { "Retry-After": "86400" },
    );
  }

  if (roleId) {
    const cached = getCachedAnswer(roleId, message);
    if (cached) {
      await recordChatUsage(session.userId);
      return new Response(streamText(cached, safety), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Chat-Mode": "cache",
        },
      });
    }
  }

  const client = getOpenAIClient();
  if (!client) {
    const fallbackRole = roleId ?? "khac";
    const fallback = getFallbackAnswer(message, fallbackRole);
    return new Response(streamText(fallback.answer, fallback.safety ?? safety), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const profile = await resolveProfileBasics(session.userId);
    const effectiveRoleId = roleId ?? profile.roleId;
    const conversationMemory = forceNew
      ? ""
      : await loadCoreContext(session.userId, audience);

    const conversationId = await getOrCreateConversation(
      session.userId,
      audience,
      forceNew ? null : conversationIdRaw,
      {
        forceNew,
        initialTitle: forceNew ? summarizeChatSessionTitle(message) : undefined,
      },
    );
    const history = await loadRecentChatMessages(conversationId);

    const clarifyCompleted = countClarifyStepsCompleted([
      ...history,
      { role: "user", content: message },
    ]);
    const conversationMemoryForPrompt =
      clarifyCompleted > 0 ? "" : conversationMemory;
    let employeePreferredAddress:
      | import("@/lib/learning-profile").PreferredAddress
      | undefined;
    const clarifyContext = buildClarifyContextFromHistory(
      history,
      message,
      profile.fullName,
      effectiveRoleId,
      employeePreferredAddress,
    );
    const clarifyAnswers = collectClarifyAnswers(history, message);
    const clarifyAnswersSummary = summarizeClarifyAnswersFromHistory(
      history,
      message,
    );
    const clarifyHint = buildClarifyRuntimeHint(
      clarifyCompleted,
      message,
      clarifyAnswersSummary,
      clarifyContext,
    );
    let systemPrompt: string;
    // Skill-gating chỉ áp cho employee, KHÔNG trong luồng clarify (đừng khịa giữa lúc làm rõ).
    let skillHint = "";
    let skillGating: SkillGatingResult | null = null;
    const runSkillGating =
      !isManager &&
      clarifyCompleted === 0 &&
      !isClarifyUserAnswer(message);
    if (isManager) {
      const teamSummary = await getTeamAnalysisSummary(session.userId);
      systemPrompt = buildManagerSystemPrompt({
        fullName: profile.fullName,
        currentMessage: message,
        coreContext: conversationMemory,
        teamSummary,
        freshConversation: forceNew,
      });
    } else if (effectiveRoleId) {
      const learningContext = await loadOrganizationLearningContext(
        session.userId,
      );
      const [curriculumSummary, extraSkillSummary, personalCtx] = await Promise.all([
        buildCurriculumKnowledgeContext(
          session.userId,
          effectiveRoleId,
          message,
          learningContext,
        ),
        buildExtraSkillLessonsContext(session.userId, effectiveRoleId, message),
        buildPersonalKnowledgeContext(session.userId),
      ]);
      systemPrompt = buildEmployeeSystemPrompt(effectiveRoleId, {
        fullName: profile.fullName,
        preferredAddress: personalCtx.preferredAddress,
        currentMessage: message,
        curriculumSummary,
        extraSkillSummary,
        personalSummary: personalCtx.block,
        companySummary: formatOrganizationLearningContext(learningContext),
        ahaSummary: personalCtx.ahaSummary,
        conversationMemory: conversationMemoryForPrompt,
        freshConversation: forceNew,
      });
      employeePreferredAddress = personalCtx.preferredAddress;

      if (runSkillGating) {
        try {
          const { modules, progressByModuleId } = await loadGatingModulesForUser(
            session.userId,
            effectiveRoleId,
            learningContext,
          );
          const relevantModules = findRelevantModulesForQuery(
            modules,
            message,
            progressByModuleId,
          );
          const extraSkillMatch = findExtraSkillLessonForQuery(
            effectiveRoleId,
            message,
          );
          // Lấy skillKey ứng viên TRƯỚC để đọc counter (CASE A cần priorReaskCount).
          const candidates = collectGatingCandidates({
            relevantModules,
            extraSkillMatch,
            progressByModuleId,
          });
          const primary = candidates[0] ?? null;
          let priorReaskCount = 0;
          if (primary && primary.status === "hoan-thanh") {
            priorReaskCount = await loadSkillInquiryCount(
              session.userId,
              primary.skillSlug ?? primary.moduleId,
            );
          }
          skillGating = resolveSkillGating({
            roleId: effectiveRoleId,
            message,
            relevantModules,
            extraSkillMatch,
            progressByModuleId,
            priorReaskCount,
          });
          skillHint = buildSkillGatingHint(skillGating);
        } catch (err) {
          console.error("[skill-gating]", err);
          skillGating = null;
          skillHint = "";
        }
      }
    } else {
      return apiError(
        "VALIDATION_ERROR",
        "Chưa chọn vai trò. Hoàn thành onboarding trước.",
      );
    }

    const effectiveSystemPrompt = [systemPrompt, clarifyHint, skillHint]
      .filter(Boolean)
      .join("\n\n");

    // Auto-capture skill gap (CASE C + near-miss): server-side, fail-open, KHÔNG chặn stream.
    // Giữ promise để cập nhật ai_attempt sau khi có câu trả lời.
    let skillGapCapturePromise: Promise<{ skillGapId: string } | null> | null = null;
    if (skillGating && skillGating.decision === "no-lesson" && effectiveRoleId) {
      skillGapCapturePromise = resolveUserOrganizationId(session.userId).then(
        (organizationId) =>
          captureSkillGap({
            userId: session.userId,
            organizationId,
            roleId: effectiveRoleId,
            question: message,
            bestMatchScore: skillGating?.bestMatchScore ?? 0,
            suggestedSkillSlug: null,
          }),
      );
      void skillGapCapturePromise.catch((err) =>
        console.error("[skill-gating:capture]", err),
      );
    }

    const openaiMessages: OpenAIChatMessage[] = [
      { role: "system", content: effectiveSystemPrompt },
      ...history,
    ];
    const maxTokens =
      clarifyCompleted >= MAX_CLARIFY_QUESTIONS
        ? isManager
          ? 1500
          : 1200
        : isManager
          ? 650
          : 550;
    const maxContextTokens = await getSetting("max_context_tokens");
    const trimmedMessages = trimChatMessagesToBudget(
      openaiMessages,
      maxContextTokens,
    );
    const finalHistory = trimmedMessages.slice(1);
    const enableChatEval = await getSetting("enable_chat_eval");

    await recordChatUsage(session.userId);

    void logUserActivity(session.userId, "chat.message", {
      conversationId,
      length: message.length,
    });

    await saveUserMessageOnly(session.userId, conversationId, message);
    void refineConversationTitle(session.userId, conversationId, message);

    const encoder = new TextEncoder();
    let sentSafety = false;
    let assistantText = "";

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        if (safety) {
          controller.enqueue(encoder.encode(`__SAFETY__:${safety}\n`));
          sentSafety = true;
        }

        const ticker = startThinkingTicker(
          (chunk) => controller.enqueue(chunk),
          encoder,
        );

        try {
          const state = await chatAgent.invoke({
            query: message,
            userId: session.userId,
            roleId: effectiveRoleId || "khac",
            systemPrompt: effectiveSystemPrompt,
            memoryContext: conversationMemoryForPrompt,
            history: finalHistory,
            metadata: {
              conversationId,
              skipEval: true,
              isManager,
              forceNew,
              synthesis: clarifyCompleted >= MAX_CLARIFY_QUESTIONS,
              maxTokens,
            },
          });
          assistantText = state.response || "";
          ticker.stop();
          const clarifyStep = clarifyCompleted + 1;
          assistantText = stripLeadingAssistantGreeting(
            finalizeClarifyingAssistantText(assistantText, clarifyStep, {
              userJustAnsweredClarify: isClarifyUserAnswer(message),
              clarifyContext,
              clarifyCompleted,
              clarifyAnswers,
            }),
          );
          // BUG-08: xoá link /lo-trinh/[slug] nếu slug không có trong pool thật.
          if (effectiveRoleId && assistantText.includes("/lo-trinh/")) {
            const knownModules = getLearningModulesByRole(effectiveRoleId, 0);
            assistantText = stripInventedModuleLinks(assistantText, knownModules);
          }
          if (assistantText) {
            await streamChunks(controller, encoder, assistantText);
          }
          controller.close();

          if (assistantText.trim()) {
            void appendAssistantReply(
              session.userId,
              conversationId,
              assistantText.trim(),
            ).then(() =>
              refreshCoreContext(session.userId, audience, [
                ...history,
                { role: "user", content: message },
                { role: "assistant", content: assistantText.trim() },
              ]),
            );

            // CASE A: tăng counter cà khịa cho đúng skill đã học (atomic, fail-open).
            if (
              skillGating &&
              skillGating.decision === "answered-learned" &&
              skillGating.skillKey &&
              skillGating.primary
            ) {
              void bumpSkillInquiryCounter(
                session.userId,
                skillGating.skillKey,
                skillGating.primary.moduleId,
                skillGating.primary.skillSlug,
              );
            }

            // CASE C: lưu câu trả lời khéo léo AI đã đưa vào gap (tham khảo cho người curate).
            if (skillGapCapturePromise) {
              const reply = assistantText.trim();
              void skillGapCapturePromise.then((res) => {
                if (res?.skillGapId) {
                  void updateSkillGapAiAttempt(res.skillGapId, reply);
                }
              });
            }

            if (enableChatEval) {
              void runChatEvaluation({
                query: message,
                response: assistantText.trim(),
                contexts: Array.isArray(state.retrievedContexts)
                  ? state.retrievedContexts
                  : [],
                userId: session.userId,
                conversationId,
              });
            }
          }
        } catch (err) {
          ticker.stop();
          console.error("[chat-stream]", err);
          if (!sentSafety) {
            controller.enqueue(
              encoder.encode(
                "Xin lỗi, em gặp lỗi khi trả lời. Thử lại sau nhé.",
              ),
            );
          }
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Chat-Mode": "openai",
        "X-Conversation-Id": conversationId,
        ...(skillGating ? { "X-Skill-Gating": skillGating.decision } : {}),
      },
    });
  } catch (err) {
    console.error("[chat-openai]", err);
    return apiError("INTERNAL_ERROR", "Trợ lý AI tạm thời không phản hồi.");
  }
}
