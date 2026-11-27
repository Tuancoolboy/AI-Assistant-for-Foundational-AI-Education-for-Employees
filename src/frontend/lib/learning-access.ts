import { fetchModulesForRole } from "@/lib/learning-modules";
import { isFreeAccessRole, isFreeModule } from "@/lib/learning-tiers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const DEFAULT_TRIAL_MODULE_LIMIT = 3;
export const LEGACY_DEFAULT_ORGANIZATION_NAME = "Tổ chức mặc định";

export type LearningAccessMode = "full" | "trial" | "blocked";
export type LearningAccessSource =
  | "organization"
  | "user"
  | "default-trial";

export type LearningAccessDecision = {
  mode: LearningAccessMode;
  source: LearningAccessSource;
  roleId: string | null;
  aiLevel: number;
  organizationId: string | null;
  trialLimit: number;
  allowedModuleIds: string[];
  blockingReason: string | null;
};

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

type ProfileAccessRow = {
  role_id: string | null;
  ai_level: number | null;
  learning_activated: boolean | null;
};

type MembershipRow = {
  organization_id: string;
  organizations?: { name?: string | null } | { name?: string | null }[] | null;
};

type EntitlementRow = {
  status: "trial" | "active" | "blocked" | "expired";
  trial_module_limit: number | null;
  expires_at: string | null;
};

function organizationNameOf(row: MembershipRow | null): string | null {
  const org = row?.organizations;
  if (Array.isArray(org)) return org[0]?.name ?? null;
  return org?.name ?? null;
}

function isExpired(row: EntitlementRow | null): boolean {
  if (!row?.expires_at) return false;
  const expiresAt = new Date(row.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

async function loadCurrentEntitlement(
  supabase: SupabaseServiceClient,
  scopeType: "user" | "organization",
  scopeId: string | null,
): Promise<EntitlementRow | null> {
  if (!scopeId) return null;
  const { data, error } = await supabase
    .from("learning_entitlements")
    .select("status, trial_module_limit, expires_at")
    .eq("scope_type", scopeType)
    .eq("scope_id", scopeId)
    .is("ended_at", null)
    .maybeSingle();

  if (error) {
    if (/learning_entitlements|does not exist/i.test(error.message)) return null;
    throw error;
  }
  return (data as EntitlementRow | null) ?? null;
}

// Gói dùng thử = đúng danh sách 6 bài free CỐ ĐỊNH (FREE_MODULE_NUMS), không phải N bài đầu lộ trình.
// Lọc theo module thật của vai trò để chỉ trả về bài tồn tại + đã publish.
async function loadFreeModuleIds(
  supabase: SupabaseServiceClient,
  roleId: string | null,
  aiLevel: number,
): Promise<string[]> {
  if (!roleId) return [];
  const modules = await fetchModulesForRole(roleId, aiLevel);
  return modules.filter((module) => isFreeModule(module.id)).map((module) => module.id);
}

export async function loadLearningAccess(
  userId: string,
): Promise<LearningAccessDecision> {
  const supabase = createSupabaseServiceClient();

  const [{ data: profile }, { data: membershipRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role_id, ai_level, learning_activated")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, organizations(name)")
      .eq("user_id", userId),
  ]);

  const prof = (profile as ProfileAccessRow | null) ?? null;
  const roleId = prof?.role_id ?? null;
  const aiLevel = prof?.ai_level ?? 0;
  const learningActivated = Boolean(prof?.learning_activated);
  const memberships = ((membershipRows ?? []) as MembershipRow[]).filter(
    (row) => organizationNameOf(row) !== LEGACY_DEFAULT_ORGANIZATION_NAME,
  );
  const organizationId = memberships[0]?.organization_id ?? null;

  // Đã kích hoạt học HOẶC học viên khóa miễn phí (vd vibe-code) → mở toàn bộ bài,
  // không phụ thuộc entitlement/gói thử. Khóa miễn phí mở cho mọi tài khoản đăng ký.
  if (learningActivated || isFreeAccessRole(roleId)) {
    return {
      mode: "full",
      source: "user",
      roleId,
      aiLevel,
      organizationId,
      trialLimit: DEFAULT_TRIAL_MODULE_LIMIT,
      allowedModuleIds: [],
      blockingReason: null,
    };
  }

  const [userEntitlement, organizationEntitlement] = await Promise.all([
    loadCurrentEntitlement(supabase, "user", userId),
    loadCurrentEntitlement(supabase, "organization", organizationId),
  ]);

  const trialLimit =
    userEntitlement?.trial_module_limit ??
    organizationEntitlement?.trial_module_limit ??
    DEFAULT_TRIAL_MODULE_LIMIT;

  if (userEntitlement?.status === "blocked" || organizationEntitlement?.status === "blocked") {
    return {
      mode: "blocked",
      source: userEntitlement?.status === "blocked" ? "user" : "organization",
      roleId,
      aiLevel,
      organizationId,
      trialLimit,
      allowedModuleIds: [],
      blockingReason: "Tài khoản hiện chưa được mở quyền học.",
    };
  }

  if (organizationEntitlement?.status === "active" && !isExpired(organizationEntitlement)) {
    return {
      mode: "full",
      source: "organization",
      roleId,
      aiLevel,
      organizationId,
      trialLimit,
      allowedModuleIds: [],
      blockingReason: null,
    };
  }

  if (userEntitlement?.status === "active" && !isExpired(userEntitlement)) {
    return {
      mode: "full",
      source: "user",
      roleId,
      aiLevel,
      organizationId,
      trialLimit,
      allowedModuleIds: [],
      blockingReason: null,
    };
  }

  const allowedModuleIds = await loadFreeModuleIds(supabase, roleId, aiLevel);

  return {
    mode: "trial",
    source: "default-trial",
    roleId,
    aiLevel,
    organizationId,
    trialLimit,
    allowedModuleIds,
    blockingReason: null,
  };
}

export function canAccessModule(
  decision: LearningAccessDecision,
  moduleId: string | null | undefined,
): boolean {
  if (decision.mode === "full") return true;
  if (decision.mode === "blocked") return false;
  if (!moduleId) return true;
  return decision.allowedModuleIds.includes(moduleId);
}

export function learningAccessDeniedMessage(decision: LearningAccessDecision): string {
  if (decision.mode === "blocked") {
    return decision.blockingReason ?? "Tài khoản hiện chưa được mở quyền học.";
  }
  return `Bạn đang ở gói học thử ${decision.trialLimit} bài đầu. Vui lòng nâng cấp để học tiếp.`;
}
