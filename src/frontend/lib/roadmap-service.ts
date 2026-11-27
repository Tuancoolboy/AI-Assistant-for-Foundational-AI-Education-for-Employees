// Truy vấn + tính % cho LMS roadmap opt-out. Tái dùng giữa các endpoint member.
// % opt-out: mẫu số = số bài is_selected=true; tử số = bài is_selected & hoàn thành.
// Tách cấp độ qua toLmsLevel (4 cấp, gộp L5→Master). Sort chính theo sort_order.

import type { SupabaseClient } from "@supabase/supabase-js";
import { LMS_LEVELS, toLmsLevel, type LmsLevel } from "@/lib/lms-levels";

export type ModuleStatus = "chua-hoc" | "dang-hoc" | "hoan-thanh";

export type RoadmapModuleNode = {
  id: string;
  title: string;
  isSelected: boolean;
  status: ModuleStatus;
};

export type RoadmapLevelNode = {
  level: LmsLevel;
  label: string;
  modules: RoadmapModuleNode[];
};

export type RoadmapGroupNode = {
  slug: string;
  label: string;
  percent: number;
  levels: RoadmapLevelNode[];
};

// Một dòng roadmap đã ghép trạng thái + metadata bài (để dựng cây / tính %).
type FlatRow = {
  moduleId: string;
  skillSlug: string;
  isSelected: boolean;
  status: ModuleStatus;
  title: string;
  level: number;
  sortOrder: number;
};

type SB = SupabaseClient;

/** Nhóm user sở hữu (active) kèm nhãn + sort. Nguồn khóa phạm vi. */
export async function getOwnedGroups(
  supabase: SB,
  userId: string,
): Promise<{ slug: string; label: string; sortOrder: number }[]> {
  const { data, error } = await supabase
    .from("user_skill_groups")
    .select("skill_slug, skill_groups(label, sort_order)")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error(`getOwnedGroups: ${error.message}`);
  return (data ?? []).map((r) => {
    const g = (r as { skill_groups: { label?: string; sort_order?: number } | null })
      .skill_groups;
    return {
      slug: (r as { skill_slug: string }).skill_slug,
      label: g?.label ?? (r as { skill_slug: string }).skill_slug,
      sortOrder: g?.sort_order ?? 0,
    };
  });
}

/** True nếu user đang sở hữu (active) nhóm chứa bài này. */
export async function userOwnsGroup(
  supabase: SB,
  userId: string,
  skillSlug: string | null | undefined,
): Promise<boolean> {
  if (!skillSlug) return false;
  const { data, error } = await supabase
    .from("user_skill_groups")
    .select("skill_slug")
    .eq("user_id", userId)
    .eq("skill_slug", skillSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`userOwnsGroup: ${error.message}`);
  return Boolean(data);
}

// Đọc toàn bộ dòng roadmap của user + ghép title/level/sort + status tiến độ.
async function loadFlatRows(supabase: SB, userId: string): Promise<FlatRow[]> {
  const { data: roadmap, error } = await supabase
    .from("user_roadmap")
    .select("module_id, skill_slug, is_selected, learning_modules(title, level, sort_order)")
    .eq("user_id", userId);
  if (error) throw new Error(`loadFlatRows:roadmap: ${error.message}`);

  const { data: progress, error: pErr } = await supabase
    .from("module_progress")
    .select("module_id, status")
    .eq("user_id", userId);
  if (pErr) throw new Error(`loadFlatRows:progress: ${pErr.message}`);

  const statusByModule = new Map<string, ModuleStatus>();
  for (const p of progress ?? []) {
    statusByModule.set(
      (p as { module_id: string }).module_id,
      (p as { status: ModuleStatus }).status,
    );
  }

  return (roadmap ?? []).map((r) => {
    const row = r as {
      module_id: string;
      skill_slug: string;
      is_selected: boolean;
      learning_modules: { title?: string; level?: number; sort_order?: number } | null;
    };
    const lm = row.learning_modules;
    return {
      moduleId: row.module_id,
      skillSlug: row.skill_slug,
      isSelected: row.is_selected,
      status: statusByModule.get(row.module_id) ?? "chua-hoc",
      title: lm?.title ?? row.module_id,
      level: lm?.level ?? 1,
      sortOrder: lm?.sort_order ?? 9999,
    };
  });
}

// % 1 nhóm từ tập dòng (mẫu số = is_selected=true).
function percentFor(rows: FlatRow[]): number {
  const selected = rows.filter((r) => r.isSelected);
  if (selected.length === 0) return 0;
  const done = selected.filter((r) => r.status === "hoan-thanh").length;
  return Math.round((done / selected.length) * 100);
}

/** Cây Nhóm → 4 cấp → Bài. Chỉ nhóm user sở hữu; sort bài theo sort_order. */
export async function getRoadmapTree(
  supabase: SB,
  userId: string,
): Promise<RoadmapGroupNode[]> {
  const [owned, rows] = await Promise.all([
    getOwnedGroups(supabase, userId),
    loadFlatRows(supabase, userId),
  ]);

  const rowsBySlug = new Map<string, FlatRow[]>();
  for (const r of rows) {
    const list = rowsBySlug.get(r.skillSlug) ?? [];
    list.push(r);
    rowsBySlug.set(r.skillSlug, list);
  }

  return owned
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => {
      const groupRows = (rowsBySlug.get(group.slug) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      const levels: RoadmapLevelNode[] = LMS_LEVELS.map((lv) => ({
        level: lv.level,
        label: lv.label,
        modules: groupRows
          .filter((r) => toLmsLevel(r.level) === lv.level)
          .map((r) => ({
            id: r.moduleId,
            title: r.title,
            isSelected: r.isSelected,
            status: r.status,
          })),
      })).filter((lvl) => lvl.modules.length > 0);

      return {
        slug: group.slug,
        label: group.label,
        percent: percentFor(groupRows),
        levels,
      };
    });
}

/** % nhóm + tổng (mẫu số = is_selected). Tính lại từ DB cho toggle/summary. */
export async function recomputePercent(
  supabase: SB,
  userId: string,
  skillSlug: string,
): Promise<{ group: number; total: number }> {
  const rows = await loadFlatRows(supabase, userId);
  return {
    group: percentFor(rows.filter((r) => r.skillSlug === skillSlug)),
    total: percentFor(rows),
  };
}

/** Tổng hợp tiến độ: tổng bài chọn, tổng hoàn thành, % tổng, theo nhóm. */
export async function getProgressSummary(supabase: SB, userId: string) {
  const [owned, rows] = await Promise.all([
    getOwnedGroups(supabase, userId),
    loadFlatRows(supabase, userId),
  ]);
  const selected = rows.filter((r) => r.isSelected);
  const totalSelected = selected.length;
  const totalCompleted = selected.filter((r) => r.status === "hoan-thanh").length;
  const totalLearning = selected.filter((r) => r.status === "dang-hoc").length;
  const totalNotStarted = totalSelected - totalCompleted - totalLearning;

  const byGroup = owned
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => {
      const gRows = rows.filter((r) => r.skillSlug === g.slug);
      const gSel = gRows.filter((r) => r.isSelected);
      return {
        slug: g.slug,
        label: g.label,
        totalSelected: gSel.length,
        completed: gSel.filter((r) => r.status === "hoan-thanh").length,
        percent: percentFor(gRows),
      };
    });

  return {
    totalSelected,
    totalCompleted,
    totalLearning,
    totalNotStarted,
    percent: percentFor(rows),
    byGroup,
  };
}
