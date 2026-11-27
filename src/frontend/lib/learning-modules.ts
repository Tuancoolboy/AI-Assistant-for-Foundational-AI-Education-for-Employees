// Đọc bài học từ Supabase hoặc fallback file tĩnh.

import {
  getLearningModuleById,
  getLearningModulesByRole,
  LEARNING_MODULES,
  type LearningModuleRecord,
  type ModuleSection,
} from "@/lib/learning-modules-data";
import type { AttachedFile, RubricCriterion } from "@/lib/roles";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export type { LearningModuleRecord, ModuleSection };

type DbRow = {
  id: string;
  role_id: string;
  title: string;
  duration_min: number;
  level: number;
  sort_order: number;
  summary: string;
  content: string;
  learnings: string[];
  sections: ModuleSection[];
  practice_prompt: string;
  tool?: string | null;
  attached_file?: AttachedFile | null;
  published?: boolean;
  skill_slug?: string | null;
};

function mapRow(row: DbRow): LearningModuleRecord {
  // Rubric chưa có cột riêng trong DB (thêm dần) → lấy từ data tĩnh theo id.
  // tool: ưu tiên cột DB (migration 0017), fallback data tĩnh.
  const staticMod = getLearningModuleById(row.id);
  const rubric: RubricCriterion[] = staticMod?.rubric ?? [];
  return {
    id: row.id,
    role_id: row.role_id,
    title: row.title,
    duration_min: row.duration_min,
    level: row.level as 1 | 2 | 3,
    sort_order: row.sort_order,
    summary: row.summary,
    content: row.content,
    learnings: row.learnings ?? [],
    sections: row.sections ?? [],
    practice_prompt: row.practice_prompt ?? "",
    tool: row.tool ?? staticMod?.tool ?? null,
    toolReason: staticMod?.toolReason ?? null,
    rubric,
    attached_file: row.attached_file ?? staticMod?.attached_file ?? null,
    skill_slug: row.skill_slug ?? staticMod?.skill_slug ?? null,
  };
}

export async function fetchModulesForRole(
  roleId: string,
  aiLevel = 0,
): Promise<LearningModuleRecord[]> {
  if (!isSupabaseConfigured()) {
    return getLearningModulesByRole(roleId, aiLevel);
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("learning_modules")
      .select("*")
      .eq("role_id", roleId)
      .eq("published", true)
      .order("sort_order", { ascending: true });

    if (error || !data?.length) {
      return getLearningModulesByRole(roleId, aiLevel);
    }

    let list = data.map((row) => mapRow(row as DbRow));
    if (aiLevel >= 5) {
      list = list.filter((m) => m.level >= 2);
    }
    return list;
  } catch {
    return getLearningModulesByRole(roleId, aiLevel);
  }
}

export type ModuleOrderItem = { id: string; sort_order: number };

// Danh sách id + thứ tự (NHẸ) cho 1 vai trò — chỉ để tính "bài kế tiếp".
// KHÔNG kéo nội dung đầy đủ (trang bài học trước đây fetch cả 84 record ~3s chỉ
// để tìm next id). Fallback data tĩnh khi chưa cấu hình Supabase hoặc lỗi.
export async function fetchModuleOrderForRole(
  roleId: string,
  aiLevel = 0,
): Promise<ModuleOrderItem[]> {
  const fromStatic = () =>
    getLearningModulesByRole(roleId, aiLevel).map((m) => ({
      id: m.id,
      sort_order: m.sort_order,
    }));

  if (!isSupabaseConfigured()) return fromStatic();

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("learning_modules")
      .select("id, sort_order, level")
      .eq("role_id", roleId)
      .eq("published", true)
      .order("sort_order", { ascending: true });
    if (error || !data?.length) return fromStatic();
    let rows = data as { id: string; sort_order: number; level: number }[];
    if (aiLevel >= 5) rows = rows.filter((r) => r.level >= 2);
    return rows.map((r) => ({ id: r.id, sort_order: r.sort_order }));
  } catch {
    return fromStatic();
  }
}

export type ModuleCount = { total: number; advanced: number };

// Số bài học thật mỗi vai trò (đã publish) để hiển thị ở onboarding/teaser.
// `advanced` = bài level >= 2. Đọc DB là nguồn đúng (admin thêm bài → tự cập nhật);
// fallback đếm từ data tĩnh khi chưa cấu hình Supabase.
export async function fetchPublishedModuleCounts(): Promise<
  Record<string, ModuleCount>
> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase
        .from("learning_modules")
        .select("role_id, level")
        .eq("published", true);
      if (!error && data?.length) {
        const counts: Record<string, ModuleCount> = {};
        for (const row of data as { role_id: string; level: number }[]) {
          const c = (counts[row.role_id] ??= { total: 0, advanced: 0 });
          c.total += 1;
          if (row.level >= 2) c.advanced += 1;
        }
        return counts;
      }
    } catch {
      // rơi xuống fallback tĩnh bên dưới
    }
  }
  return countModulesFromStatic();
}

// Danh sách id bài đã publish mỗi vai trò — để onboarding tính ĐÚNG số bài thật
// sự học được (giao với lựa chọn theo khảo sát), khớp số hiển thị ở /lo-trinh.
export async function fetchPublishedModuleIds(): Promise<
  Record<string, string[]>
> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase
        .from("learning_modules")
        .select("id, role_id")
        .eq("published", true);
      if (!error && data?.length) {
        const ids: Record<string, string[]> = {};
        for (const row of data as { id: string; role_id: string }[]) {
          (ids[row.role_id] ??= []).push(row.id);
        }
        return ids;
      }
    } catch {
      // rơi xuống fallback tĩnh
    }
  }
  const ids: Record<string, string[]> = {};
  for (const m of LEARNING_MODULES) (ids[m.role_id] ??= []).push(m.id);
  return ids;
}

function countModulesFromStatic(): Record<string, ModuleCount> {
  const counts: Record<string, ModuleCount> = {};
  for (const m of LEARNING_MODULES) {
    const c = (counts[m.role_id] ??= { total: 0, advanced: 0 });
    c.total += 1;
    if (m.level >= 2) c.advanced += 1;
  }
  return counts;
}

export async function fetchModuleById(
  moduleId: string,
): Promise<LearningModuleRecord | null> {
  if (!isSupabaseConfigured()) {
    return getLearningModuleById(moduleId);
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("learning_modules")
      .select("*")
      .eq("id", moduleId)
      .eq("published", true)
      .maybeSingle();

    if (error || !data) {
      return getLearningModuleById(moduleId);
    }
    return mapRow(data as DbRow);
  } catch {
    return getLearningModuleById(moduleId);
  }
}
