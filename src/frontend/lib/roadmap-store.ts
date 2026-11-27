// State management cho roadmap opt-out (useReducer + optimistic updates).
// Ref: docs/system-architecture-lms-roadmap.md §6

export type ModuleStatus = "chua-hoc" | "dang-hoc" | "hoan-thanh";

export type RoadmapModule = {
  id: string;
  title: string;
  isSelected: boolean;
  status: ModuleStatus;
};

export type LevelNode = {
  level: number;
  label: string;
  modules: RoadmapModule[];
};

export type GroupNode = {
  slug: string;
  label: string;
  percent: number;
  levels: LevelNode[];
};

export type RoadmapState = {
  selected: Record<string, boolean>;
  status: Record<string, ModuleStatus>;
  pending: Set<string>;
};

export type RoadmapAction =
  | { type: "TOGGLE_OPTIMISTIC"; moduleId: string; next: boolean }
  | {
      type: "TOGGLE_CONFIRMED";
      moduleId: string;
      groupPercent?: number;
      totalPercent?: number;
    }
  | { type: "TOGGLE_ROLLBACK"; moduleId: string; prev: boolean };

export function roadmapReducer(
  state: RoadmapState,
  action: RoadmapAction,
): RoadmapState {
  switch (action.type) {
    case "TOGGLE_OPTIMISTIC": {
      const pending = new Set(state.pending);
      pending.add(action.moduleId);
      return {
        ...state,
        selected: { ...state.selected, [action.moduleId]: action.next },
        pending,
      };
    }
    case "TOGGLE_CONFIRMED": {
      const pending = new Set(state.pending);
      pending.delete(action.moduleId);
      return { ...state, pending };
    }
    case "TOGGLE_ROLLBACK": {
      const pending = new Set(state.pending);
      pending.delete(action.moduleId);
      return {
        ...state,
        selected: { ...state.selected, [action.moduleId]: action.prev },
        pending,
      };
    }
  }
}

/** Build initial state from GET /api/member/roadmap response. */
export function initRoadmapState(groups: GroupNode[]): RoadmapState {
  const selected: Record<string, boolean> = {};
  const status: Record<string, ModuleStatus> = {};
  for (const group of groups) {
    for (const level of group.levels) {
      for (const mod of level.modules) {
        selected[mod.id] = mod.isSelected;
        status[mod.id] = mod.status;
      }
    }
  }
  return { selected, status, pending: new Set() };
}

/**
 * % tiến độ của 1 nhóm dựa trên client state.
 * Denominator = bài có is_selected===true.
 * Numerator = bài selected + status==="hoan-thanh".
 */
export function groupPercent(
  state: RoadmapState,
  moduleIds: string[],
): number {
  const selectedIds = moduleIds.filter((id) => state.selected[id]);
  if (selectedIds.length === 0) return 0;
  const done = selectedIds.filter(
    (id) => state.status[id] === "hoan-thanh",
  ).length;
  return Math.round((done / selectedIds.length) * 100);
}

/**
 * % tiến độ tổng toàn bộ lộ trình.
 */
export function totalPercent(
  state: RoadmapState,
  allModuleIds: string[],
): number {
  return groupPercent(state, allModuleIds);
}
