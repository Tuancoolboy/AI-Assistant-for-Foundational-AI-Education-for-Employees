import type { ChatGraphStateType } from "./graph-state";
import { getLearningModulesByRole } from "@/lib/learning-modules-data";
import { findRelevantModulesForQuery } from "@/lib/chat-knowledge-curriculum";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import type { RoleId } from "@/lib/openai";

export async function retrieveContextNode(state: ChatGraphStateType) {
  const query = state.query || "";
  const roleId = (state.roleId || "khac") as RoleId;
  const userId = state.userId;

  const retrieved: string[] = [];

  try {
    const progressByModuleId: Record<string, string> = {};
    if (isSupabaseConfigured() && userId) {
      const supabase = await createSupabaseServerClient();
      const { data: progressRows } = await supabase
        .from("module_progress")
        .select("module_id, status")
        .eq("user_id", userId);

      for (const row of progressRows ?? []) {
        progressByModuleId[row.module_id] = row.status;
      }
    }

    const modules = getLearningModulesByRole(roleId, 0);
    const relevant = findRelevantModulesForQuery(modules, query, progressByModuleId, 3);

    for (const item of relevant) {
      const levelLabel =
        item.mod.level === 1 ? "Nhập môn" : item.mod.level === 2 ? "Trung cấp" : "Nâng cao";
      retrieved.push(
        `Bài học: ${item.mod.title} (Mức độ: ${levelLabel})\nMô tả: ${item.mod.summary}\nKỹ năng: ${item.mod.learnings.join(", ")}`
      );
    }
  } catch (e) {
    console.error("[retrieveContextNode] Error:", e);
  }

  return { retrievedContexts: retrieved };
}
