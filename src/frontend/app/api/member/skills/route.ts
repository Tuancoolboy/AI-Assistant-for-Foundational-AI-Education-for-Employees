// API "Bộ kỹ năng cá nhân" (FE-16). GET: danh sách skill đã lưu. POST: lưu skill của
// 1 bài (tra module_skills). Chỉ real mode (Supabase). RLS chặn theo auth.uid().

import { resolveApiSession } from "@/lib/api-auth";
import { apiError, apiOk } from "@/lib/api-error";
import {
  canAccessLearning,
  loadLearningActivationRecord,
} from "@/lib/learning-activation";
import {
  canAccessModule,
  learningAccessDeniedMessage,
  loadLearningAccess,
} from "@/lib/learning-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

type SkillRow = { name: string | null; description: string | null; slug: string | null };
type SavedRow = {
  skill_id: string;
  source_module_id: string | null;
  saved_at: string;
  skills: SkillRow | SkillRow[] | null;
};

function flattenSkill(skills: SavedRow["skills"]): SkillRow | null {
  if (!skills) return null;
  return Array.isArray(skills) ? (skills[0] ?? null) : skills;
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "API kỹ năng cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }
  const access = await loadLearningActivationRecord(session.userId);
  if (!canAccessLearning(access)) {
    return apiError("FORBIDDEN", "ACCOUNT_NOT_ACTIVATED");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_saved_skills")
    .select("skill_id, source_module_id, saved_at, skills ( name, description, slug )")
    .eq("user_id", session.userId)
    .order("saved_at", { ascending: false });

  if (error) {
    console.error("[member-skills:get]", error.message);
    return apiError("INTERNAL_ERROR", "Không đọc được bộ kỹ năng.");
  }

  const skills = ((data ?? []) as SavedRow[]).map((row) => {
    const skill = flattenSkill(row.skills);
    return {
      skillId: row.skill_id,
      name: skill?.name ?? skill?.slug ?? "Kỹ năng",
      description: skill?.description ?? "",
      slug: skill?.slug ?? "",
      sourceModuleId: row.source_module_id,
      savedAt: row.saved_at,
    };
  });

  return apiOk({ skills });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "API kỹ năng cần Supabase.");
  }
  const session = await resolveApiSession();
  if (!session || session.mode !== "supabase") {
    return apiError("UNAUTHORIZED", "Bạn cần đăng nhập.");
  }
  const access = await loadLearningActivationRecord(session.userId);
  if (!canAccessLearning(access)) {
    return apiError("FORBIDDEN", "ACCOUNT_NOT_ACTIVATED");
  }

  let body: { module_id?: unknown };
  try {
    body = (await request.json()) as { module_id?: unknown };
  } catch {
    return apiError("VALIDATION_ERROR", "JSON không hợp lệ.");
  }
  const moduleId = typeof body.module_id === "string" ? body.module_id.trim() : "";
  if (!moduleId) {
    return apiError("VALIDATION_ERROR", "Thiếu module_id.");
  }
  const learningAccess = await loadLearningAccess(session.userId);
  if (!canAccessModule(learningAccess, moduleId)) {
    return apiError("FORBIDDEN", learningAccessDeniedMessage(learningAccess));
  }

  const supabase = await createSupabaseServerClient();

  // Tra kỹ năng của bài qua module_skills (đọc, không sửa schema skills/module_skills).
  const { data: links, error: linkError } = await supabase
    .from("module_skills")
    .select("skill_id")
    .eq("module_id", moduleId);

  if (linkError) {
    console.error("[member-skills:post:links]", linkError.message);
    return apiError("INTERNAL_ERROR", "Không tra được kỹ năng của bài.");
  }

  const skillIds = (links ?? [])
    .map((l) => l.skill_id as string)
    .filter((id) => typeof id === "string");

  if (skillIds.length === 0) {
    return apiOk({
      saved: [],
      message: "Bài này chưa gắn kỹ năng nào để lưu.",
    });
  }

  const rows = skillIds.map((skill_id) => ({
    user_id: session.userId,
    skill_id,
    source_module_id: moduleId,
  }));

  // Upsert bỏ qua trùng (unique user_id+skill_id) → lưu trùng không tạo bản ghi đôi.
  const { error: upsertError } = await supabase
    .from("user_saved_skills")
    .upsert(rows, { onConflict: "user_id,skill_id", ignoreDuplicates: true });

  if (upsertError) {
    console.error("[member-skills:post:upsert]", upsertError.message);
    return apiError("INTERNAL_ERROR", "Không lưu được kỹ năng.");
  }

  const { data: saved } = await supabase
    .from("user_saved_skills")
    .select("skill_id, source_module_id, saved_at, skills ( name, description, slug )")
    .eq("user_id", session.userId)
    .in("skill_id", skillIds);

  const savedSkills = ((saved ?? []) as SavedRow[]).map((row) => {
    const skill = flattenSkill(row.skills);
    return {
      skillId: row.skill_id,
      name: skill?.name ?? skill?.slug ?? "Kỹ năng",
      description: skill?.description ?? "",
      slug: skill?.slug ?? "",
      sourceModuleId: row.source_module_id,
      savedAt: row.saved_at,
    };
  });

  return apiOk({ saved: savedSkills });
}
