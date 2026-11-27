// FE-native learning-path agent service.
// Route chỉ lo auth/guard; service tự resolve Supabase context, cache, generate,
// và preview phòng ban.

import type { ApiSession } from "@/lib/api-auth";
import {
  buildDeptPreviewInput,
  computeFingerprint,
  resolveFlowInput,
  type AgentInputHints,
} from "./path-agent-input";
import { generatePath } from "./path-agent";
import { readCachedPath, writeCachedPath } from "./path-agent-cache";

export type LearningPathAgentPayload = AgentInputHints & {
  forceRefresh?: unknown;
  skillSlugs?: unknown;
  primaryTool?: unknown;
};

export async function runLearningPathAgent(
  session: ApiSession,
  body: LearningPathAgentPayload,
): Promise<{ path: Awaited<ReturnType<typeof generatePath>>; source: string; cached: boolean }> {
  const forceRefresh = body.forceRefresh === true;

  // Nhánh preview phòng ban: skillSlugs được truyền trực tiếp từ builder.
  const previewSkills = Array.isArray(body.skillSlugs)
    ? body.skillSlugs.filter((x): x is string => typeof x === "string")
    : [];
  if (previewSkills.length > 0) {
    const input = buildDeptPreviewInput({
      skillSlugs: previewSkills,
      roleId: typeof body.roleId === "string" ? body.roleId : undefined,
      aiLevel: typeof body.aiLevel === "number" ? body.aiLevel : undefined,
      primaryTool: typeof body.primaryTool === "string" ? body.primaryTool : undefined,
    });
    const result = await generatePath(input, computeFingerprint(input));
    return { path: result, source: result.source, cached: false };
  }

  const input = await resolveFlowInput(session, {
    roleId: body.roleId,
    aiLevel: body.aiLevel,
    completedModuleIds: body.completedModuleIds,
    dailyTasks: body.dailyTasks,
  });
  const fingerprint = computeFingerprint(input);

  if (!forceRefresh && session.mode === "supabase") {
    const cached = await readCachedPath(session.userId, fingerprint);
    if (cached && cached.fingerprint === fingerprint) {
      return { path: cached, source: cached.source, cached: true };
    }
  }

  const result = await generatePath(input, fingerprint);

  if (session.mode === "supabase") {
    await writeCachedPath(session.userId, input, result);
  }

  return { path: result, source: result.source, cached: false };
}
