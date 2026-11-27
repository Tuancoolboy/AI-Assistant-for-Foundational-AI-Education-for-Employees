// Route guard server-side cho /lo-trinh/[moduleId] (FE-15 §4): chặn mở bài nằm trong
// tier bị khoá. Chỉ áp dụng khi user ĐÃ chốt lộ trình và bài thuộc tập đã chọn.
// Bài ngoài tập (vd bài kỹ năng thêm) không thuộc luồng tier → không bị chặn ở đây.

import { isModuleLocked, type TierGateInput } from "@/lib/learning-tiers";
import { getRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function isModuleAccessBlocked(
  userId: string,
  moduleId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_id, learning_path_confirmed_at")
    .eq("id", userId)
    .maybeSingle<{
      role_id: string | null;
      learning_path_confirmed_at: string | null;
    }>();

  const roleId = profile?.role_id ?? null;
  // Chưa chốt lộ trình → màn composition lo, không chặn route.
  if (!roleId || !profile?.learning_path_confirmed_at) return false;
  if (!getRole(roleId)) return false;

  const [selectionRes, progressRes, quizRes] = await Promise.all([
    supabase
      .from("user_learning_selection")
      .select("module_id")
      .eq("user_id", userId),
    supabase.from("module_progress").select("module_id, status").eq("user_id", userId),
    supabase
      .from("quiz_results")
      .select("module_id, passed")
      .eq("user_id", userId)
      .eq("passed", true),
  ]);

  const selectedModuleIds = (selectionRes.data ?? [])
    .map((r) => r.module_id as string)
    .filter((id) => typeof id === "string");

  const progress: Record<string, string> = {};
  for (const row of progressRes.data ?? []) {
    if (typeof row.module_id === "string" && typeof row.status === "string") {
      progress[row.module_id] = row.status;
    }
  }

  const passedGateModuleIds = new Set<string>(
    (quizRes.data ?? [])
      .map((r) => r.module_id as string | null)
      .filter((id): id is string => typeof id === "string"),
  );

  const input: TierGateInput = {
    selectedModuleIds,
    progress,
    passedGateModuleIds,
  };

  return isModuleLocked(roleId, moduleId, input);
}
