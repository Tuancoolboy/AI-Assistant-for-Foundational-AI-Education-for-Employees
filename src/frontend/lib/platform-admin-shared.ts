import { ROLES } from "@/lib/roles";

export const PLATFORM_ADMIN_ORGANIZATION_STATUSES = [
  "active",
  "suspended",
  "archived",
] as const;

export const PLATFORM_ADMIN_AI_TOOLS = [
  "claude",
  "chatgpt",
  "gemini",
  "copilot",
] as const;

export const PLATFORM_ADMIN_MEMBER_ROLES = [
  "owner",
  "manager",
  "employee",
] as const;

export const PLATFORM_ADMIN_ORG_ADMIN_ROLES = [
  "super_admin",
  "admin",
] as const;

export const PLATFORM_ADMIN_ORG_ADMIN_PERMISSION_KEYS = [
  "members",
  "learning",
  "content",
  "analytics",
  "invite_links",
  "accounts",
] as const;

export const PLATFORM_ADMIN_ACCOUNT_TYPES = [
  "company",
  "individual",
] as const;

export const PLATFORM_ADMIN_CONTENT_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

export const PLATFORM_ADMIN_CONTENT_COLLECTIONS = [
  "learning_modules",
  "training_modules",
  "learning_paths",
  "assessments",
] as const;

export const PLATFORM_ADMIN_ROLE_IDS = Object.keys(ROLES).sort();

export const PLATFORM_ADMIN_ACTIONS = [
  "toggle-organization-status",
  "update-organization",
  "toggle-platform-admin",
  "create-organization-admin",
  "update-user",
  "delete-users",
  "reset-user-learning",
  "set-user-activation",
  "bulk-set-activation",
  "set-content-status",
  "rotate-invite-link",
] as const;

const PLATFORM_ADMIN_ACTION_LABELS: Record<string, string> = {
  "toggle-organization-status": "Đổi trạng thái tổ chức",
  "update-organization": "Cập nhật công ty",
  "toggle-platform-admin": "Cấp hoặc thu hồi quyền super-admin",
  "create-organization-admin": "Tạo tài khoản admin tổ chức",
  "update-user": "Cập nhật người dùng",
  "delete-users": "Xoá tài khoản",
  "reset-user-learning": "Xoá dữ liệu học tập",
  "set-user-activation": "Kích hoạt hoặc huỷ kích hoạt",
  "bulk-set-activation": "Kích hoạt hàng loạt",
  "set-content-status": "Đổi trạng thái nội dung",
  "rotate-invite-link": "Xoay link mời",
};

const AI_TOOL_ALIASES: Record<string, (typeof PLATFORM_ADMIN_AI_TOOLS)[number]> = {
  claude: "claude",
  chatgpt: "chatgpt",
  gemini: "gemini",
  copilot: "copilot",
  "chat gpt": "chatgpt",
};

export function isCanonicalAiTool(value: string): value is (typeof PLATFORM_ADMIN_AI_TOOLS)[number] {
  return (PLATFORM_ADMIN_AI_TOOLS as readonly string[]).includes(value);
}

/**
 * Map a stored ai_tool value onto a canonical key when it clearly matches one
 * (direct or via alias). Unknown non-empty values are PRESERVED as-is so a
 * custom tool string is never silently rewritten to "claude" on read/save.
 */
export function normalizeAiToolValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "claude";
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (isCanonicalAiTool(lower)) return lower;
  if (AI_TOOL_ALIASES[lower]) return AI_TOOL_ALIASES[lower];
  return trimmed;
}

export function getPlatformAdminAiToolLabel(value: string): string {
  switch (normalizeAiToolValue(value)) {
    case "claude":
      return "Claude";
    case "chatgpt":
      return "ChatGPT";
    case "gemini":
      return "Gemini";
    case "copilot":
      return "Copilot";
    default:
      return "Khác";
  }
}

export function getPlatformAdminAuditActionLabel(action: string): string {
  return PLATFORM_ADMIN_ACTION_LABELS[action] ?? action;
}
