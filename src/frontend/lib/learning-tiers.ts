// Lộ trình 5 tier + khoá tuần tự (FE-15 + Phase-3). Logic thuần, không phụ thuộc React/DB —
// dễ test. Màn 5 tier chỉ hiển thị + khoá trên TẬP BÀI người dùng đã chọn (composition),
// không phải toàn bộ module của vai trò.
//
// Gán tier: suy từ `level` của module:
//   level 1 → tier 1 (Cơ bản)
//   level 2 → tier 2/3 (chia đôi theo thứ tự bài — nửa đầu tier 2, nửa sau tier 3)
//   level 3 → tier 4 (Master) ← GIỮ NGUYÊN để bài cũ không bị lệch tier
//   level 4 → tier 4 (Master) ← gộp với level 3 (backward-compat)
//   level 5 → tier 5 (Master+) ← mới Phase-3
// Bảng gán tập trung ở MODULE_TIER_MAP để duyệt 1 chỗ thay vì rải khắp roles.ts.

import { ROLES, getRole, type QuizQuestion } from "@/lib/roles";
import { HR_SKILL_LABELS } from "@/lib/roles-hr";

export type Tier = 1 | 2 | 3 | 4 | 5;

// Nhóm việc của module (FE: "phân loại theo nhóm bài liên quan"). Lấy skill chính (skills[0])
// đã gắn tĩnh ở roles-hr.ts. Bài chưa gắn nhóm (vd bài mới chưa tag) → null → "chưa phân loại".
function buildModuleCategoryMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const role of Object.values(ROLES)) {
    for (const m of role.modules) {
      const slug = m.skills?.[0];
      if (slug) map[m.id] = slug;
    }
  }
  return map;
}

export const MODULE_CATEGORY_MAP: Record<string, string> = buildModuleCategoryMap();

// Nhóm việc cho bài CHỈ có trong DB (nhan-su m57–m64), chưa có trong roles-hr.ts tĩnh.
// Suy từ tiêu đề bài — review/chỉnh tại đây (slug phải khớp HR_SKILL_LABELS).
const MODULE_CATEGORY_OVERRIDE: Record<string, string> = {
  "nhan-su-m57": "hr-nen-tang", // Đạo đức & thiên kiến AI
  "nhan-su-m58": "hr-nen-tang", // An toàn dữ liệu nâng cao
  "nhan-su-m59": "hr-tu-dong-hoa", // Agentic AI cho HR
  "nhan-su-m60": "hr-tu-dong-hoa", // Kết nối Claude–HR qua MCP
  "nhan-su-m61": "hr-tu-dong-hoa", // Plugin HR Anthropic
  "nhan-su-m62": "hr-quan-he-chinh-sach", // Quản trị thay đổi đưa AI vào HR
  "nhan-su-m63": "hr-tu-dong-hoa", // Trợ lý nhắc deadline/checklist
  "nhan-su-m64": "hr-hanh-chinh-ops", // Cập nhật file theo dõi từ PDF
};

export function getModuleCategorySlug(moduleId: string): string | null {
  return MODULE_CATEGORY_MAP[moduleId] ?? MODULE_CATEGORY_OVERRIDE[moduleId] ?? null;
}

export function getModuleCategoryLabel(moduleId: string): string {
  const slug = getModuleCategorySlug(moduleId);
  return (slug && HR_SKILL_LABELS[slug]) || "Khác / chưa phân loại";
}

export const LEARNING_TIERS: { id: Tier; label: string; color: string }[] = [
  { id: 1, label: "Cơ bản",    color: "bg-sky-100 text-sky-700" },
  { id: 2, label: "Nâng cao",  color: "bg-violet-100 text-violet-700" },
  { id: 3, label: "Nâng trình", color: "bg-amber-100 text-amber-700" },
  { id: 4, label: "Master",    color: "bg-rose-100 text-rose-700" },
  { id: 5, label: "Master+",   color: "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" },
];

export function tierLabel(tier: Tier): string {
  return LEARNING_TIERS.find((t) => t.id === tier)?.label ?? `Tier ${tier}`;
}

// Số câu trong 1 bài kiểm tra cổng (gate quiz).
export const GATE_QUIZ_SIZE = 3;

// Suy tier cho mọi module từ `level`.
// - level 1 → tier 1 (Cơ bản)
// - level 2 → tier 2/3 (chia đôi — nửa đầu tier 2, nửa sau tier 3)
// - level 3 → tier 4 (Master) ← GIỮ NGUYÊN để bài cũ (L3) không bị lệch tier khi sync
// - level 4 → tier 4 (Master) ← gộp với level 3 (backward-compat, Notion 4-tier cũ)
// - level 5 → tier 5 (Master+) ← mới Phase-3; cần DB widened + EM sync
function buildModuleTierMap(): Record<string, Tier> {
  const map: Record<string, Tier> = {};
  for (const role of Object.values(ROLES)) {
    const level2Count = role.modules.filter((m) => m.level === 2).length;
    const tier2Quota = Math.ceil(level2Count / 2); // nửa đầu (làm tròn lên) → tier 2
    let seenLevel2 = 0;
    for (const m of role.modules) {
      // Cast to number: roles.ts định nghĩa level: 1|2|3, nhưng DB/HR có thể có 4/5.
      // Dùng (m.level as number) để tránh TS "no overlap" error.
      const lv = m.level as number;
      if (lv === 1) {
        map[m.id] = 1;
      } else if (lv === 2) {
        map[m.id] = seenLevel2 < tier2Quota ? 2 : 3;
        seenLevel2 += 1;
      } else if (lv === 5) {
        map[m.id] = 5;
      } else {
        // level 3 và level 4 đều → tier 4 (Master)
        // Lý do: Notion hiện gán level 3 = "Master"; level 4 được nới theo 4-tier spec.
        // Dồn cả hai vào tier 4 để bài cũ không bị lệch. Level 5 mới → tier 5.
        map[m.id] = 4;
      }
    }
  }
  return map;
}

// Bảng gán tier (moduleId → tier). Nguồn sự thật cho phân tier — review tại đây.
export const MODULE_TIER_MAP: Record<string, Tier> = buildModuleTierMap();

export function getModuleTier(moduleId: string): Tier {
  return MODULE_TIER_MAP[moduleId] ?? 1;
}

// Module tối thiểu để suy tier (từ DB learning_modules, không có trong roles.ts tĩnh).
export type TierableModule = { id: string; level: number };

// Dựng map tier từ DANH SÁCH module thật (DB) thay vì data tĩnh — cần khi kho bài DB
// nhiều hơn static (vd nhan-su có 64 bài, static chỉ 56). Cùng quy tắc với
// buildModuleTierMap: level 1→tier1, level 2 chia đôi (nửa đầu tier2/nửa sau tier3),
// level 3/4 → tier4, level 5 → tier5. Giữ nguyên thứ tự đầu vào (đã sort theo sort_order).
export function buildTierMapFromModules(
  modules: TierableModule[],
): Record<string, Tier> {
  const map: Record<string, Tier> = {};
  const level2Count = modules.filter((m) => m.level === 2).length;
  const tier2Quota = Math.ceil(level2Count / 2);
  let seenLevel2 = 0;
  for (const m of modules) {
    if (m.level === 1) {
      map[m.id] = 1;
    } else if (m.level === 5) {
      map[m.id] = 5;
    } else if (m.level >= 3) {
      map[m.id] = 4;
    } else {
      map[m.id] = seenLevel2 < tier2Quota ? 2 : 3;
      seenLevel2 += 1;
    }
  }
  return map;
}

// module_id quy ước để ghi quiz_results cho gate quiz từng tier.
export function gateQuizModuleId(roleId: string, tier: Tier): string {
  return `${roleId}-tier${tier}-quiz`;
}

// Parse "{roleId}-tier{n}-quiz" → tier (null nếu không khớp).
export function parseGateTier(moduleId: string): Tier | null {
  const m = /-tier([1-5])-quiz$/.exec(moduleId);
  if (!m) return null;
  return Number(m[1]) as Tier;
}

// Bài kiểm tra cổng cho 1 tier: tái dùng role.quiz sẵn có (đã được duyệt nội dung),
// xoay vòng theo tier để các tier không trùng câu khi pool đủ lớn.
// TODO(content): biên soạn bộ câu hỏi gate chuyên biệt theo từng tier cho từng vai trò;
// hiện tái dùng pool role.quiz để tránh bịa kiến thức sai.
export function getGateQuiz(roleId: string, tier: Tier): QuizQuestion[] {
  const role = getRole(roleId);
  const pool = role?.quiz ?? [];
  if (pool.length === 0) return [];
  const take = Math.min(GATE_QUIZ_SIZE, pool.length);
  const start = (tier - 1) % pool.length;
  const out: QuizQuestion[] = [];
  for (let i = 0; i < take; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

// Sắp xếp module theo đúng thứ tự định nghĩa trong roles.ts (độ khó tăng dần).
export function orderModuleIdsByRole(roleId: string, ids: string[]): string[] {
  const role = getRole(roleId);
  const order = new Map((role?.modules ?? []).map((m, i) => [m.id, i]));
  return [...ids].sort(
    (a, b) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999),
  );
}

export type TierGateInput = {
  // Tập bài đã chốt (composition). Màn 4 tier chỉ thao tác trên tập này.
  selectedModuleIds: string[];
  // moduleId → trạng thái (chua-hoc | dang-hoc | hoan-thanh).
  progress: Record<string, string>;
  // module_id của các gate quiz đã đạt (quiz_results.passed = true).
  passedGateModuleIds: Set<string>;
};

export type TierView = {
  tier: Tier;
  label: string;
  moduleIds: string[];
  completed: number;
  total: number;
  percent: number;
  // Khối đã mở (cho học bài bên trong).
  unlocked: boolean;
  // Đã đạt gate quiz CỦA tier này.
  gatePassed: boolean;
  // Đã hoàn thành hết bài CỦA tier này.
  allModulesDone: boolean;
  gateModuleId: string;
};

// Dựng danh sách tier "có bài" (chỉ những tier xuất hiện trong tập đã chọn), tính khoá
// tuần tự: tier đầu tiên luôn mở; tier kế mở khi tier liền trước đã hoàn thành hết bài
// VÀ đạt gate quyz của tier liền trước. Tier rỗng (không có bài được chọn) bị bỏ qua.
// opts: khi tập bài lấy từ DB (nhiều hơn static), truyền tierOf/orderOf suy từ DB
// để m57–m64 (chỉ có trong DB) được phân tier + sắp xếp đúng. Bỏ trống → dùng map tĩnh.
export type BuildTierOpts = {
  tierOf?: (id: string) => Tier;
  orderOf?: (id: string) => number;
};

export function buildTierViews(
  roleId: string,
  input: TierGateInput,
  opts: BuildTierOpts = {},
): TierView[] {
  const tierOf = opts.tierOf ?? getModuleTier;
  const byTier = new Map<Tier, string[]>();
  for (const id of input.selectedModuleIds) {
    const t = tierOf(id);
    const list = byTier.get(t) ?? [];
    list.push(id);
    byTier.set(t, list);
  }

  const activeTiers = [...byTier.keys()].sort((a, b) => a - b);
  const views: TierView[] = [];

  for (const tier of activeTiers) {
    const rawIds = byTier.get(tier) ?? [];
    const moduleIds = opts.orderOf
      ? [...rawIds].sort((a, b) => opts.orderOf!(a) - opts.orderOf!(b))
      : orderModuleIdsByRole(roleId, rawIds);
    const total = moduleIds.length;
    const completed = moduleIds.filter(
      (id) => input.progress[id] === "hoan-thanh",
    ).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const gateModuleId = gateQuizModuleId(roleId, tier);
    const gatePassed = input.passedGateModuleIds.has(gateModuleId);
    const allModulesDone = total > 0 && completed === total;
    // Tất cả tier đều mở để học viên click học tự do (bỏ khoá tuần tự).
    // Vẫn giữ phân nhóm 4 tier + bài kiểm tra cổng (tự nguyện).
    const unlocked = true;

    views.push({
      tier,
      label: tierLabel(tier),
      moduleIds,
      completed,
      total,
      percent,
      unlocked,
      gatePassed,
      allModulesDone,
      gateModuleId,
    });
  }

  return views;
}

// Kiểm tra 1 module có bị khoá không (cho route guard /lo-trinh/[moduleId]).
// Chỉ áp dụng khi module nằm trong tập đã chọn; module ngoài tập (vd bài kỹ năng thêm)
// không thuộc luồng tier → không bị khoá ở đây.
// Bỏ khoá tuần tự: mọi bài trong lộ trình đều học được (không chặn route).
export function isModuleLocked(
  _roleId: string,
  _moduleId: string,
  _input: TierGateInput,
): boolean {
  return false;
}

// ---------------------------------------------------------------------------
// Freemium gate (Phase 0): 6 bài free CỐ ĐỊNH dùng chung mọi vai trò.
// Dùng số thứ tự module (phần sau "-m") thay vì full id để không bị ràng buộc vai trò.
// ---------------------------------------------------------------------------

export const FREE_MODULE_NUMS = ["m0", "m1", "m3", "m4", "m9", "m6"];

// ---------------------------------------------------------------------------
// Vai trò HỌC MIỄN PHÍ hoàn toàn — mở toàn bộ bài cho mọi tài khoản đã đăng ký,
// KHÔNG cần kích hoạt (learning_activated) như các khóa khác. Vd khóa "Học viên
// K2 - Vibe Code". Nguồn sự thật duy nhất cho cả gate server (learning-access)
// lẫn hiển thị client (lo-trinh-tiers).
// ---------------------------------------------------------------------------
export const FREE_ACCESS_ROLE_IDS = ["vibe-code"];

export function isFreeAccessRole(roleId: string | null | undefined): boolean {
  return Boolean(roleId) && FREE_ACCESS_ROLE_IDS.includes(roleId as string);
}

/** Chuẩn hóa module id → lấy phần số thứ tự cuối (vd "nhan-su-m1" → "m1"). */
function normalizeModuleNum(moduleId: string): string {
  const match = /(-m\d+)$/.exec(moduleId);
  return match ? match[1].slice(1) : moduleId;
}

/** Kiểm tra module có trong danh sách 6 bài free không. */
export function isFreeModule(moduleId: string): boolean {
  const num = normalizeModuleNum(moduleId);
  return FREE_MODULE_NUMS.includes(num);
}

/**
 * Trả về true nếu module bị khoá freemium.
 * activated=true → không khoá gì; false → khoá bài không thuộc FREE_MODULE_NUMS.
 */
export function isModulePaywalled(moduleId: string, activated: boolean): boolean {
  if (activated) return false;
  return !isFreeModule(moduleId);
}
