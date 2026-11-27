import type { ChatGraphStateType } from "./graph-state";
import { resolveProfileBasics, getTeamAnalysisSummary } from "@/lib/chat-context";
import {
  loadOrganizationLearningContext,
  formatOrganizationLearningContext,
} from "@/lib/chat-knowledge-company";
import { buildExtraSkillLessonsContext } from "@/lib/chat-knowledge-extra";
import { buildPersonalKnowledgeContext } from "@/lib/chat-knowledge-personal";
import { buildCurriculumKnowledgeContext } from "@/lib/chat-knowledge-curriculum";
import {
  buildEmployeeSystemPrompt,
  buildManagerSystemPrompt,
  type RoleId,
} from "@/lib/openai";

export async function augmentPromptNode(state: ChatGraphStateType) {
  const query = state.query || "";
  const userId = state.userId;
  const roleId = state.roleId as RoleId;
  const metadata = state.metadata || {};
  const isManager = !!metadata.isManager;
  const memoryContext = state.memoryContext || "";
  const retrievedContexts = state.retrievedContexts || [];

  // Nếu caller (vd /api/chat) đã build sẵn system prompt — gồm clarify framing,
  // skill-gating, safety — thì dùng nguyên, KHÔNG build lại. Build lại vừa nhân đôi
  // DB/context calls vừa làm mất các tinh chỉnh đó. Chỉ tự build khi state thiếu prompt
  // (vd graph được gọi standalone).
  const providedPrompt = (state.systemPrompt || "").trim();
  let systemPrompt = providedPrompt || "Bạn là Trợ lý AI.";
  let augmentedPrompt = query;

  try {
    if (!providedPrompt) {
      systemPrompt = await buildFallbackSystemPrompt({
        userId,
        roleId,
        query,
        isManager,
        memoryContext,
        forceNew: !!metadata.forceNew,
      });
    }

    // Lắp ráp augmentedPrompt kết hợp RAG contexts (luôn chạy)
    let augmented = "";
    if (retrievedContexts.length > 0) {
      augmented += "Dưới đây là một số tài liệu học tập/ngữ cảnh hỗ trợ liên quan:\n";
      augmented += retrievedContexts.join("\n---\n") + "\n\n";
    }
    augmented += query;
    augmentedPrompt = augmented;
  } catch (e) {
    console.error("[augmentPromptNode] Error:", e);
  }

  return {
    systemPrompt,
    augmentedPrompt,
  };
}

interface FallbackPromptArgs {
  userId: string;
  roleId: RoleId;
  query: string;
  isManager: boolean;
  memoryContext: string;
  forceNew: boolean;
}

async function buildFallbackSystemPrompt({
  userId,
  roleId,
  query,
  isManager,
  memoryContext,
  forceNew,
}: FallbackPromptArgs): Promise<string> {
  const profile = await resolveProfileBasics(userId);

  if (isManager) {
    const teamSummary = await getTeamAnalysisSummary(userId);
    return buildManagerSystemPrompt({
      fullName: profile.fullName,
      currentMessage: query,
      coreContext: memoryContext,
      teamSummary,
      freshConversation: forceNew,
    });
  }

  if (roleId) {
    const learningContext = await loadOrganizationLearningContext(userId);
    const [curriculumSummary, extraSkillSummary, personalCtx] = await Promise.all([
      buildCurriculumKnowledgeContext(userId, roleId, query, learningContext),
      buildExtraSkillLessonsContext(userId, roleId, query),
      buildPersonalKnowledgeContext(userId),
    ]);

    return buildEmployeeSystemPrompt(roleId, {
      fullName: profile.fullName,
      preferredAddress: personalCtx.preferredAddress,
      currentMessage: query,
      curriculumSummary,
      extraSkillSummary,
      personalSummary: personalCtx.block,
      companySummary: formatOrganizationLearningContext(learningContext),
      ahaSummary: personalCtx.ahaSummary,
      conversationMemory: memoryContext,
      freshConversation: forceNew,
    });
  }

  return "Bạn là Trợ lý AI.";
}
