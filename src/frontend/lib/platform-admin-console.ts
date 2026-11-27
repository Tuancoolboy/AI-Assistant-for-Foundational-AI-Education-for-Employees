import { randomBytes } from "node:crypto";
import {
  DEMO_ADMIN_USERS,
  DEMO_AUDIT_ENTRIES,
  DEMO_COMPANIES,
  getDemoAdminStats,
} from "@/lib/admin-data";
import { logAuditEvent } from "@/lib/audit-log";
import { getOpenAIModel, getRateLimitPerDay, isOpenAIConfigured } from "@/lib/openai";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import type { sendActivationEmail as sendActivationEmailFn } from "@/lib/email/send-activation-email";
import {
  PLATFORM_ADMIN_ACCOUNT_TYPES,
  PLATFORM_ADMIN_ACTIONS,
  PLATFORM_ADMIN_AI_TOOLS,
  PLATFORM_ADMIN_CONTENT_COLLECTIONS,
  PLATFORM_ADMIN_CONTENT_STATUSES,
  PLATFORM_ADMIN_MEMBER_ROLES,
  PLATFORM_ADMIN_ORGANIZATION_STATUSES,
  PLATFORM_ADMIN_ORG_ADMIN_PERMISSION_KEYS,
  PLATFORM_ADMIN_ORG_ADMIN_ROLES,
  PLATFORM_ADMIN_ROLE_IDS,
  getPlatformAdminAuditActionLabel,
  normalizeAiToolValue,
} from "@/lib/platform-admin-shared";
import type {
  PlatformAdminAhaReflectionRow,
  PlatformAdminAuditRow,
  PlatformAdminConsoleFilters,
  PlatformAdminConsoleReport,
  PlatformAdminContentItemRow,
  PlatformAdminContentRow,
  PlatformAdminOrgAdminPermissions,
  PlatformAdminOrgAdminRow,
  PlatformAdminOrgAdminRole,
  PlatformAdminInviteLinkRow,
  PlatformAdminOrganizationDetailRow,
  PlatformAdminOrganizationRow,
  PlatformAdminOrganizationMemberRow,
  PlatformAdminUserRow,
} from "@/lib/platform-admin-types";

export {
  PLATFORM_ADMIN_ACCOUNT_TYPES,
  PLATFORM_ADMIN_ACTIONS,
  PLATFORM_ADMIN_AI_TOOLS,
  PLATFORM_ADMIN_CONTENT_COLLECTIONS,
  PLATFORM_ADMIN_CONTENT_STATUSES,
  getPlatformAdminAuditActionLabel,
  PLATFORM_ADMIN_MEMBER_ROLES,
  PLATFORM_ADMIN_ORGANIZATION_STATUSES,
  PLATFORM_ADMIN_ROLE_IDS,
  normalizeAiToolValue,
} from "@/lib/platform-admin-shared";

type AnyRow = Record<string, unknown>;

type AuthUserRow = {
  id: string;
  email: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role_id: string | null;
  ai_level: number | null;
  learning_activated: boolean | null;
  learning_activated_at: string | null;
  learning_activated_by: string | null;
  activation_email_sent_at: string | null;
  account_type: string | null;
  phone_number: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MembershipRow = {
  organization_id: string;
  user_id: string;
  member_role: "owner" | "manager" | "employee";
  department_id: string | null;
  invited_email: string | null;
  invited_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  organizations?:
    | { name?: string | null; slug?: string | null }
    | Array<{ name?: string | null; slug?: string | null }>
    | null;
};

export type PlatformAdminAction = (typeof PLATFORM_ADMIN_ACTIONS)[number];

function includesQuery(values: Array<string | null | undefined>, query?: string): boolean {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function applyPlatformAdminConsoleFilters(
  report: PlatformAdminConsoleReport,
  filters: PlatformAdminConsoleFilters,
): PlatformAdminConsoleReport {
  if (Object.keys(filters).length === 0) return report;

  return {
    ...report,
    organizations: report.organizations.filter(
      (org) =>
        includesQuery([org.name, org.slug, org.aiTool], filters.organizationQuery) &&
        (!filters.organizationStatus || org.status === filters.organizationStatus) &&
        includesQuery([org.aiTool], filters.organizationTool),
    ),
    users: report.users.filter((user) => {
      const matchesRole =
        !filters.userRole ||
        (filters.userRole === "platform-admin"
          ? user.platformAdmin
          : filters.userRole === "manager"
            ? user.memberRole === "manager" || user.memberRole === "owner"
            : user.memberRole === "employee" || !user.memberRole);
      return (
        includesQuery(
          [
            user.fullName,
            user.email,
            user.organizationName,
            user.roleId,
            String(user.aiLevel ?? ""),
            user.departmentId,
            user.phoneNumber,
          ],
          filters.userQuery,
        ) &&
        matchesRole &&
        (!filters.userAccount || user.accountType === filters.userAccount) &&
        (!filters.userActivation ||
          (filters.userActivation === "activated"
            ? user.learningActivated
            : !user.learningActivated))
      );
    }),
    contentItems: report.contentItems.filter(
      (item) =>
        includesQuery(
          [item.title, item.id, item.scope, item.organizationName, item.collection],
          filters.contentQuery,
        ) &&
        (!filters.contentCollection || item.collection === filters.contentCollection) &&
        (!filters.contentStatus || item.status === filters.contentStatus),
    ),
    inviteLinks: report.inviteLinks.filter(
      (link) =>
        includesQuery(
          [link.organizationName, link.token, link.createdBy],
          filters.inviteQuery,
        ) &&
        (!filters.inviteStatus ||
          (filters.inviteStatus === "active" ? link.isActive : !link.isActive)),
    ),
    audits: report.audits.filter(
      (entry) =>
        includesQuery(
          [entry.actor, entry.action, entry.actionLabel, entry.detail, entry.organizationName],
          filters.auditQuery,
        ) &&
        includesQuery([entry.action, entry.actionLabel], filters.auditAction),
    ),
  };
}

function isMissingTable(message: string): boolean {
  return /does not exist|relation .* does not exist|could not find/i.test(message);
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isStringValue(value: unknown): value is string {
  return typeof value === "string";
}

function trimStringValue(value: unknown): string {
  return isStringValue(value) ? value.trim() : "";
}

function requireTrimmedString(value: unknown, field: string): string {
  const trimmed = trimStringValue(value);
  if (!trimmed) {
    throw new Error(`VALIDATION: Thiếu ${field}.`);
  }
  return trimmed;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`VALIDATION: ${field} phải là boolean.`);
  }
  return value;
}

function requireAllowedValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  const trimmed = requireTrimmedString(value, field);
  if (!allowed.includes(trimmed as T)) {
    throw new Error(`VALIDATION: ${field} không hợp lệ.`);
  }
  return trimmed as T;
}

function optionalStringValue(value: unknown): string | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("VALIDATION: Giá trị phải là chuỗi.");
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalAllowedValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | null | undefined {
  if (typeof value === "undefined") return undefined;
  const normalized = optionalStringValue(value);
  if (normalized === null) return null;
  if (typeof normalized === "undefined") return undefined;
  if (!allowed.includes(normalized as T)) {
    throw new Error(`VALIDATION: ${field} không hợp lệ.`);
  }
  return normalized as T;
}

function optionalIntegerRangeValue(
  value: unknown,
  min: number,
  max: number,
  field: string,
): number | undefined {
  if (typeof value === "undefined") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`VALIDATION: ${field} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return value;
}

function requireIntegerRangeValue(
  value: unknown,
  min: number,
  max: number,
  field: string,
): number {
  const normalized = optionalIntegerRangeValue(value, min, max, field);
  if (typeof normalized === "undefined") {
    throw new Error(`VALIDATION: ${field} là bắt buộc.`);
  }
  return normalized;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`VALIDATION: ${field} phải là mảng.`);
  }
  const normalized = Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0),
    ),
  );
  if (normalized.length === 0) {
    throw new Error(`VALIDATION: ${field} không được rỗng.`);
  }
  if (normalized.length > 100) {
    throw new Error(`VALIDATION: ${field} vượt quá giới hạn.`);
  }
  return normalized;
}

async function sendPasswordSetupEmail(
  supabase: SupabaseServiceClient,
  email: string,
): Promise<"sent" | `failed:${string}`> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const options = appUrl
    ? { redirectTo: new URL("/tai-khoan", appUrl).toString() }
    : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, options);
  if (error) return `failed:${error.message}`;
  return "sent";
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function defaultOrgAdminPermissions(
  role: (typeof PLATFORM_ADMIN_ORG_ADMIN_ROLES)[number],
): PlatformAdminOrgAdminPermissions {
  const allowAll = role === "super_admin";
  return PLATFORM_ADMIN_ORG_ADMIN_PERMISSION_KEYS.reduce(
    (permissions, key) => {
      permissions[key] = allowAll;
      return permissions;
    },
    {} as PlatformAdminOrgAdminPermissions,
  );
}

function readOrgAdminPermissions(
  value: unknown,
  role: (typeof PLATFORM_ADMIN_ORG_ADMIN_ROLES)[number],
): PlatformAdminOrgAdminPermissions {
  const fallback = defaultOrgAdminPermissions(role);
  if (!isRecordValue(value)) return fallback;
  const permissions = { ...fallback };
  for (const key of PLATFORM_ADMIN_ORG_ADMIN_PERMISSION_KEYS) {
    if (typeof value[key] === "boolean") {
      permissions[key] = value[key];
    }
  }
  return permissions;
}

function orgAdminRoleToMemberRole(
  role: (typeof PLATFORM_ADMIN_ORG_ADMIN_ROLES)[number],
): "owner" | "manager" {
  return role === "super_admin" ? "owner" : "manager";
}

function memberRoleToOrgAdminRole(
  role: MembershipRow["member_role"] | null | undefined,
): (typeof PLATFORM_ADMIN_ORG_ADMIN_ROLES)[number] {
  return role === "owner" ? "super_admin" : "admin";
}

function parseOrgAdminDirectory(settingsJson: Record<string, unknown>): PlatformAdminOrgAdminRow[] {
  const rawEntries = settingsJson.organization_admin_directory;
  if (!Array.isArray(rawEntries)) return [];
  return rawEntries
    .filter(isRecordValue)
    .map((entry) => {
      const role: PlatformAdminOrgAdminRole =
        entry.role === "super_admin" ? "super_admin" : "admin";
      return {
        userId: safeString(entry.userId) || safeString(entry.user_id) || "",
        email: safeString(entry.email),
        fullName: safeString(entry.fullName) || safeString(entry.full_name) || "Admin tổ chức",
        role,
        departmentId:
          typeof entry.departmentId === "string"
            ? entry.departmentId
            : typeof entry.department_id === "string"
              ? entry.department_id
              : null,
        permissions: readOrgAdminPermissions(entry.permissions, role),
        createdAt:
          typeof entry.createdAt === "string"
            ? entry.createdAt
            : typeof entry.created_at === "string"
              ? entry.created_at
              : new Date().toISOString(),
        updatedAt:
          typeof entry.updatedAt === "string"
            ? entry.updatedAt
            : typeof entry.updated_at === "string"
              ? entry.updated_at
              : new Date().toISOString(),
      };
    })
    .filter((entry) => entry.email.length > 0);
}

function writeOrgAdminDirectory(
  settingsJson: Record<string, unknown> | null | undefined,
  directory: PlatformAdminOrgAdminRow[],
): Record<string, unknown> {
  const nextSettings = isRecordValue(settingsJson) ? { ...settingsJson } : {};
  nextSettings.organization_admin_directory = directory.map((entry) => ({
    userId: entry.userId,
    email: entry.email,
    fullName: entry.fullName,
    role: entry.role,
    departmentId: entry.departmentId,
    permissions: entry.permissions,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));
  return nextSettings;
}

export type PlatformAdminActionInput = {
  action: PlatformAdminAction;
  payload: Record<string, unknown>;
};

type ValidatedPlatformAdminAction =
  | {
      action: "toggle-organization-status";
      payload: {
        organizationId: string;
        status: (typeof PLATFORM_ADMIN_ORGANIZATION_STATUSES)[number];
      };
    }
  | {
      action: "update-organization";
      payload: {
        organizationId: string;
        name?: string;
        aiTool?: (typeof PLATFORM_ADMIN_AI_TOOLS)[number];
        settings?: Record<string, unknown>;
      };
    }
  | {
      action: "toggle-platform-admin";
      payload: {
        email: string;
        enabled: boolean;
      };
    }
  | {
      action: "create-organization-admin";
      payload: {
        organizationId: string;
        email: string;
        fullName: string;
        adminRole: (typeof PLATFORM_ADMIN_ORG_ADMIN_ROLES)[number];
        departmentId?: string | null;
        permissions: PlatformAdminOrgAdminPermissions;
      };
    }
  | {
      action: "update-user";
      payload: {
        userId: string;
        fullName?: string;
        phoneNumber?: string | null;
        roleId?: string | null;
        aiLevel?: number;
        accountType?: (typeof PLATFORM_ADMIN_ACCOUNT_TYPES)[number];
        organizationId?: string | null;
        memberRole?: (typeof PLATFORM_ADMIN_MEMBER_ROLES)[number] | null;
        departmentId?: string | null;
        platformAdmin?: boolean;
        email?: string;
      };
    }
  | {
      action: "delete-users";
      payload: {
        userIds: string[];
        confirmUserCount: number;
        excludePlatformAdmins?: boolean;
      };
    }
  | {
      action: "reset-user-learning";
      payload: {
        userId: string;
        scope?: "learning_recommendations";
      };
    }
  | {
      action: "set-user-activation";
      payload: {
        userId: string;
        activated: boolean;
      };
    }
  | {
      action: "bulk-set-activation";
      payload: {
        userIds: string[];
        activated: boolean;
        excludePlatformAdmins?: boolean;
      };
    }
  | {
      action: "set-content-status";
      payload: {
        collection: (typeof PLATFORM_ADMIN_CONTENT_COLLECTIONS)[number];
        id: string;
        status: (typeof PLATFORM_ADMIN_CONTENT_STATUSES)[number];
      };
    }
  | {
      action: "rotate-invite-link";
      payload: {
        organizationId: string;
  };
};

type SupabaseServiceClient = Awaited<ReturnType<typeof getSupabaseServiceClient>>;
const MAX_DELETE_USERS_PER_ACTION = 25;

export function validatePlatformAdminActionInput(
  input: PlatformAdminActionInput,
): ValidatedPlatformAdminAction {
  switch (input.action) {
    case "toggle-organization-status":
      return {
        action: input.action,
        payload: {
          organizationId: requireTrimmedString(input.payload.organizationId, "organizationId"),
          status: requireAllowedValue(
            input.payload.status,
            PLATFORM_ADMIN_ORGANIZATION_STATUSES,
            "trạng thái tổ chức",
          ),
        },
      };
    case "update-organization": {
      const organizationId = requireTrimmedString(
        input.payload.organizationId,
        "organizationId",
      );
      const payload: {
        organizationId: string;
        name?: string;
        aiTool?: (typeof PLATFORM_ADMIN_AI_TOOLS)[number];
        settings?: Record<string, unknown>;
      } = { organizationId };
      const name = optionalStringValue(input.payload.name);
      const aiTool = optionalAllowedValue(
        input.payload.aiTool,
        PLATFORM_ADMIN_AI_TOOLS,
        "aiTool",
      );
      if (typeof name === "string") payload.name = name;
      if (aiTool) payload.aiTool = aiTool;
      if (
        input.payload.settings !== undefined &&
        input.payload.settings !== null
      ) {
        if (
          typeof input.payload.settings !== "object" ||
          Array.isArray(input.payload.settings)
        ) {
          throw new Error("VALIDATION: settings phải là object.");
        }
        payload.settings = input.payload.settings as Record<string, unknown>;
      }
      return { action: input.action, payload };
    }
    case "toggle-platform-admin":
      return {
        action: input.action,
        payload: {
          email: requireTrimmedString(input.payload.email, "email"),
          enabled: requireBoolean(input.payload.enabled, "enabled"),
        },
      };
    case "create-organization-admin": {
      const organizationId = requireTrimmedString(
        input.payload.organizationId,
        "organizationId",
      );
      const email = requireTrimmedString(input.payload.email, "email");
      const fullName = requireTrimmedString(input.payload.fullName, "fullName");
      const adminRole = requireAllowedValue(
        input.payload.adminRole,
        PLATFORM_ADMIN_ORG_ADMIN_ROLES,
        "adminRole",
      );
      const departmentId = optionalStringValue(input.payload.departmentId);
      const permissions = input.payload.permissions;
      if (!isRecordValue(permissions)) {
        throw new Error("VALIDATION: permissions phải là object.");
      }
      const normalizedPermissions = PLATFORM_ADMIN_ORG_ADMIN_PERMISSION_KEYS.reduce(
        (result, key) => {
          if (typeof permissions[key] !== "boolean") {
            throw new Error(`VALIDATION: permissions.${key} phải là boolean.`);
          }
          result[key] = permissions[key];
          return result;
        },
        {} as PlatformAdminOrgAdminPermissions,
      );
      return {
        action: input.action,
        payload: {
          organizationId,
          email,
          fullName,
          adminRole,
          ...(typeof departmentId !== "undefined" ? { departmentId } : {}),
          permissions: normalizedPermissions,
        },
      };
    }
    case "update-user": {
      const userId = requireTrimmedString(input.payload.userId, "userId");
      const payload: {
        userId: string;
        fullName?: string;
        phoneNumber?: string | null;
        roleId?: string | null;
        aiLevel?: number;
        accountType?: (typeof PLATFORM_ADMIN_ACCOUNT_TYPES)[number];
        organizationId?: string | null;
        memberRole?: (typeof PLATFORM_ADMIN_MEMBER_ROLES)[number] | null;
        departmentId?: string | null;
        platformAdmin?: boolean;
        email?: string;
      } = { userId };
      const fullName = optionalStringValue(input.payload.fullName);
      if (typeof fullName === "string") payload.fullName = fullName;
      if (typeof input.payload.phoneNumber !== "undefined") {
        payload.phoneNumber = optionalStringValue(input.payload.phoneNumber) ?? null;
      }
      const roleId = optionalAllowedValue(
        input.payload.roleId,
        PLATFORM_ADMIN_ROLE_IDS,
        "roleId",
      );
      if (typeof roleId !== "undefined") payload.roleId = roleId;
      const aiLevel = optionalIntegerRangeValue(input.payload.aiLevel, 0, 5, "aiLevel");
      if (typeof aiLevel !== "undefined") payload.aiLevel = aiLevel;
      if (input.payload.accountType !== undefined) {
        payload.accountType = requireAllowedValue(
          input.payload.accountType,
          PLATFORM_ADMIN_ACCOUNT_TYPES,
          "accountType",
        );
      }
      const organizationId = optionalStringValue(input.payload.organizationId);
      if (typeof organizationId !== "undefined") payload.organizationId = organizationId;
      const memberRole = optionalAllowedValue(
        input.payload.memberRole,
        PLATFORM_ADMIN_MEMBER_ROLES,
        "memberRole",
      );
      if (typeof memberRole !== "undefined") payload.memberRole = memberRole;
      const departmentId = optionalStringValue(input.payload.departmentId);
      if (typeof departmentId !== "undefined") payload.departmentId = departmentId;
      if (input.payload.platformAdmin !== undefined) {
        payload.platformAdmin = requireBoolean(
          input.payload.platformAdmin,
          "platformAdmin",
        );
      }
      const email = optionalStringValue(input.payload.email);
      if (typeof email === "string") payload.email = email;
      return { action: input.action, payload };
    }
    case "delete-users":
      return {
        action: input.action,
        payload: {
          userIds: requireStringArray(input.payload.userIds, "userIds"),
          confirmUserCount: requireIntegerRangeValue(
            input.payload.confirmUserCount,
            1,
            MAX_DELETE_USERS_PER_ACTION,
            "confirmUserCount",
          ),
          ...(typeof input.payload.excludePlatformAdmins !== "undefined"
            ? {
                excludePlatformAdmins: requireBoolean(
                  input.payload.excludePlatformAdmins,
                  "excludePlatformAdmins",
                ),
              }
            : {}),
        },
      };
    case "reset-user-learning":
      return {
        action: input.action,
        payload: {
          userId: requireTrimmedString(input.payload.userId, "userId"),
          ...(input.payload.scope === "learning_recommendations"
            ? { scope: "learning_recommendations" as const }
            : {}),
        },
      };
    case "set-user-activation":
      return {
        action: input.action,
        payload: {
          userId: requireTrimmedString(input.payload.userId, "userId"),
          activated: requireBoolean(input.payload.activated, "activated"),
        },
      };
    case "bulk-set-activation":
      return {
        action: input.action,
        payload: {
          userIds: requireStringArray(input.payload.userIds, "userIds"),
          activated: requireBoolean(input.payload.activated, "activated"),
          ...(input.payload.excludePlatformAdmins === true
            ? { excludePlatformAdmins: true }
            : {}),
        },
      };
    case "set-content-status":
      return {
        action: input.action,
        payload: {
          collection: requireAllowedValue(
            input.payload.collection,
            PLATFORM_ADMIN_CONTENT_COLLECTIONS,
            "collection",
          ),
          id: requireTrimmedString(input.payload.id, "id"),
          status: requireAllowedValue(
            input.payload.status,
            PLATFORM_ADMIN_CONTENT_STATUSES,
            "trạng thái nội dung",
          ),
        },
      };
    case "rotate-invite-link":
      return {
        action: input.action,
        payload: {
          organizationId: requireTrimmedString(input.payload.organizationId, "organizationId"),
        },
      };
    default:
      throw new Error("VALIDATION: Hành động không được hỗ trợ.");
  }
}

function fullNameOf(profile: ProfileRow | null, authUser: AuthUserRow): string {
  return (
    safeString(profile?.full_name) ||
    safeString((authUser.user_metadata?.full_name as string | undefined) ?? null) ||
    safeString(authUser.email?.split("@")[0]) ||
    authUser.id.slice(0, 8)
  );
}

function organizationNameOf(row?: MembershipRow | null): string | null {
  const org = Array.isArray(row?.organizations)
    ? row?.organizations[0]
    : row?.organizations;
  return safeString(org?.name ?? null) || null;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Chưa có";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Chưa có";
  const diffHours = Math.floor((Date.now() - then) / (60 * 60 * 1000));
  if (diffHours < 1) return "Vừa xong";
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "Hôm qua" : `${diffDays} ngày trước`;
}

async function safeSelect<T extends AnyRow>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) {
      if (isMissingTable(error.message)) return [];
      throw new Error(error.message);
    }
    return (data ?? []) as T[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingTable(message)) return [];
    throw error;
  }
}

async function getSupabaseServiceClient() {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  return createSupabaseServiceClient();
}

async function sendPlatformAdminActivationEmail(
  ...args: Parameters<typeof sendActivationEmailFn>
) {
  const { sendActivationEmail } = await import("@/lib/email/send-activation-email");
  return sendActivationEmail(...args);
}

async function listAllAuthUsers(
  supabase: SupabaseServiceClient,
): Promise<AuthUserRow[]> {
  const users: AuthUserRow[] = [];
  const perPage = 200;
  let page = 1;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      if (isMissingTable(error.message)) return [];
      throw error;
    }

    const batch = (data.users ?? []) as AuthUserRow[];
    users.push(...batch);
    if (batch.length < perPage) return users;
    page += 1;
  }
}

function buildDemoReport(): PlatformAdminConsoleReport {
  const stats = getDemoAdminStats();
  const activeOrganizations = DEMO_COMPANIES.length;
  const managers = DEMO_ADMIN_USERS.filter((u) => u.role === "manager").length;
  const employees = DEMO_ADMIN_USERS.length - managers;

  return {
    generatedAt: new Date().toISOString(),
    persisted: false,
    message: "Dữ liệu demo — bật Supabase để xem và chỉnh hệ thống thật.",
    platform: {
      supabaseConfigured: false,
      openaiConfigured: isOpenAIConfigured(),
      openaiModel: getOpenAIModel(),
      rateLimitPerDay: getRateLimitPerDay(),
    },
    overview: {
      organizations: DEMO_COMPANIES.length,
      activeOrganizations,
      suspendedOrganizations: 0,
      archivedOrganizations: 0,
      users: DEMO_ADMIN_USERS.length,
      platformAdmins: 1,
      managers,
      employees,
      totalModules: 0,
      publishedModules: 0,
      totalPaths: 0,
      publishedPaths: 0,
      assignments: 0,
      assessments: 0,
      gradingQueue: 0,
      ahaReflections: 0,
      leads: 0,
      quizCount: stats.lessonsCompleted,
      quizAvgScore: 79,
      totalHoursSaved: 246.5,
      chatUsage7d: 64,
      chatUsage30d: 248,
      inviteLinks: 0,
      auditEvents30d: 5,
    },
    organizations: DEMO_COMPANIES.map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      status: "active",
      aiTool: normalizeAiToolValue(company.deptTools[0]?.tool ?? "claude"),
      settingsJson: {},
      memberCount: company.employeeCount + company.managerCount,
      managerCount: company.managerCount,
      employeeCount: company.employeeCount,
      updatedAt: null,
    })),
    organizationDetails: {},
    users: DEMO_ADMIN_USERS.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.name,
      accountType: user.type === "individual" ? "individual" : "company",
      roleId: null,
      aiLevel: 0,
      learningActivated: false,
      learningActivatedAt: null,
      activationEmailSentAt: null,
      organizationId: null,
      organizationName: user.org,
      memberRole: user.role === "manager" ? "manager" : "employee",
      departmentId: null,
      platformAdmin: false,
      phoneNumber: null,
      createdAt: null,
      updatedAt: null,
      lastActivityAt: null,
    })),
    content: [
      {
        label: "Lộ trình",
        status: "demo",
        count: 0,
        note: "Mở Supabase để đọc dữ liệu thật.",
      },
    ],
    contentItems: [],
    ahaReflections: [],
    inviteLinks: [],
    audits: DEMO_AUDIT_ENTRIES.map((entry) => ({
      id: entry.id,
      actor: entry.actor,
      action: entry.action,
      actionLabel: getPlatformAdminAuditActionLabel(entry.action),
      detail: entry.detail,
      organizationName: null,
      at: entry.at,
    })),
    alerts: [
      "Demo mode đang bật.",
      "Chưa nối Supabase service role để xem dữ liệu thật.",
    ],
  };
}

export async function loadPlatformAdminConsoleReport(
  _actorId: string,
  filters: PlatformAdminConsoleFilters = {},
): Promise<PlatformAdminConsoleReport> {
  if (
    !isSupabaseConfigured() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  ) {
    return applyPlatformAdminConsoleFilters(buildDemoReport(), filters);
  }

  const supabase = await getSupabaseServiceClient();

  const tab = filters.tab;

  const organizationsPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "nguoi-dung" || tab === "aha-moment" || tab === "bitemporal" || tab === "noi-dung")
    ? safeSelect(
        supabase
          .from("organizations")
          .select("id, name, slug, status, ai_tool, settings_json, updated_at")
          .order("updated_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const membershipsPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "nguoi-dung" || tab === "bitemporal" || tab === "ai-usage")
    ? safeSelect(
        supabase
          .from("organization_members")
          .select("organization_id, user_id, member_role, department_id, invited_email, invited_at, created_at, updated_at, organizations(name, slug)")
          .order("created_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const profilesPromise = (tab === undefined || tab === "tong-quan" || tab === "nguoi-dung" || tab === "to-chuc" || tab === "bitemporal" || tab === "ai-usage" || tab === "aha-moment")
    ? safeSelect(
        supabase
          .from("profiles")
          .select(
            "id, full_name, email, role_id, ai_level, learning_activated, learning_activated_at, learning_activated_by, activation_email_sent_at, account_type, phone_number, created_at, updated_at",
          )
          .order("updated_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const authUsersPromise = (tab === undefined || tab === "tong-quan" || tab === "nguoi-dung" || tab === "aha-moment" || tab === "bitemporal" || tab === "nhat-ky")
    ? listAllAuthUsers(supabase)
    : Promise.resolve([]);

  const platformAdminsPromise = (tab === undefined || tab === "tong-quan" || tab === "nguoi-dung" || tab === "bitemporal")
    ? safeSelect(
        supabase
          .from("platform_admins")
          .select("user_id, note, created_at")
          .order("created_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const learningModulesPromise = (tab === undefined || tab === "tong-quan" || tab === "noi-dung" || tab === "aha-moment")
    ? safeSelect(
        supabase
          .from("learning_modules")
          .select("id, status, role_id, title, created_at, updated_at")
          .order("updated_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const trainingModulesPromise = (tab === undefined || tab === "tong-quan" || tab === "noi-dung")
    ? safeSelect(
        supabase
          .from("training_modules")
          .select("id, status, title, scope, organization_id, created_at, updated_at")
          .order("updated_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const learningPathsPromise = (tab === undefined || tab === "tong-quan" || tab === "noi-dung")
    ? safeSelect(
        supabase
          .from("learning_paths")
          .select("id, status, title, scope, organization_id, path_type, version, updated_at")
          .order("updated_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const learningAssignmentsPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "noi-dung")
    ? safeSelect(
        supabase
          .from("learning_assignments")
          .select("id, organization_id, user_id, status, assigned_at, completed_at")
          .order("assigned_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const assessmentsPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "noi-dung")
    ? safeSelect(
        supabase
          .from("assessments")
          .select("id, organization_id, status, title, assessment_type, updated_at")
          .order("updated_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const gradingResultsPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "noi-dung")
    ? safeSelect(
        supabase
          .from("grading_results")
          .select("id, organization_id, user_id, review_status, score, confidence, created_at")
          .order("created_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const ahaReflectionsPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "noi-dung" || tab === "aha-moment")
    ? safeSelect(
        supabase
          .from("aha_reflections")
          .select(
            "id, organization_id, user_id, module_id, insight, next_action, visibility, created_at",
          )
          .order("created_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const leadsPromise = (tab === undefined || tab === "tong-quan")
    ? safeSelect(
        supabase
          .from("leads")
          .select("id, email, name, source, created_at")
          .order("created_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const eventsPromise = (tab === undefined || tab === "tong-quan" || tab === "nhat-ky")
    ? safeSelect(
        supabase
          .from("events")
          .select("id, user_id, event_name, properties_json, created_at")
          .order("created_at", { ascending: false })
          .limit(120),
      )
    : Promise.resolve([]);

  const chatUsagePromise = (tab === undefined || tab === "tong-quan" || tab === "ai-usage")
    ? safeSelect(
        supabase
          .from("chat_usage")
          .select("id, user_id, used_at")
          .order("used_at", { ascending: false })
          .limit(5000),
      )
    : Promise.resolve([]);

  const quizResultsPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "ai-usage")
    ? safeSelect(
        supabase
          .from("quiz_results")
          .select("id, user_id, score, passed, created_at")
          .order("created_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const timeLogsPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "ai-usage")
    ? safeSelect(
        supabase
          .from("time_logs")
          .select("id, user_id, hours_saved, logged_at")
          .order("logged_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const inviteLinksPromise = (tab === undefined || tab === "tong-quan" || tab === "to-chuc" || tab === "noi-dung")
    ? safeSelect(
        supabase
          .from("organization_invite_links")
          .select("id, organization_id, created_by, token, is_active, created_at, updated_at, last_used_at")
          .order("created_at", { ascending: false }),
      )
    : Promise.resolve([]);

  const [organizations, memberships, profiles, authUsers, platformAdmins, learningModules, trainingModules, learningPaths, learningAssignments, assessments, gradingResults, ahaReflections, leads, events, chatUsage, quizResults, timeLogs, inviteLinks] =
    await Promise.all([
      organizationsPromise,
      membershipsPromise,
      profilesPromise,
      authUsersPromise,
      platformAdminsPromise,
      learningModulesPromise,
      trainingModulesPromise,
      learningPathsPromise,
      learningAssignmentsPromise,
      assessmentsPromise,
      gradingResultsPromise,
      ahaReflectionsPromise,
      leadsPromise,
      eventsPromise,
      chatUsagePromise,
      quizResultsPromise,
      timeLogsPromise,
      inviteLinksPromise,
    ]);

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const platformAdminIds = new Set(platformAdmins.map((row) => row.user_id));
  const organizationNameById = new Map(
    organizations.map((org) => [org.id, safeString(org.name)]),
  );
  const learningModuleTitleById = new Map(
    learningModules.map((module) => [safeString(module.id), safeString(module.title)]),
  );

  const membershipByUser = new Map<string, MembershipRow>();
  const membershipsByOrg = new Map<string, MembershipRow[]>();
  for (const row of memberships) {
    membershipByUser.set(row.user_id, row);
    const list = membershipsByOrg.get(row.organization_id) ?? [];
    list.push(row);
    membershipsByOrg.set(row.organization_id, list);
  }

  const organizationRows: PlatformAdminOrganizationRow[] = organizations.map((org) => {
    const members = membershipsByOrg.get(org.id) ?? [];
    const managerCount = members.filter((row) => row.member_role !== "employee").length;
    const employeeCount = members.filter((row) => row.member_role === "employee").length;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      aiTool: normalizeAiToolValue(org.ai_tool),
      settingsJson: isRecordValue(org.settings_json) ? org.settings_json : {},
      memberCount: members.length,
      managerCount,
      employeeCount,
      updatedAt: typeof org.updated_at === "string" ? org.updated_at : null,
    };
  });

  const users: PlatformAdminUserRow[] = authUsers.map((authUser) => {
    const profile = profileById.get(authUser.id) ?? null;
    const membership = membershipByUser.get(authUser.id) ?? null;
    const organizationName = organizationNameOf(membership);
    return {
      id: authUser.id,
      email: authUser.email ?? "",
      fullName: fullNameOf(profile, authUser),
      accountType: profile?.account_type === "individual" ? "individual" : "company",
      roleId: profile?.role_id ?? null,
      aiLevel: typeof profile?.ai_level === "number" ? profile.ai_level : null,
      learningActivated: Boolean(profile?.learning_activated),
      learningActivatedAt: profile?.learning_activated_at ?? null,
      activationEmailSentAt: profile?.activation_email_sent_at ?? null,
      organizationId: membership?.organization_id ?? null,
      organizationName,
      memberRole: membership?.member_role ?? null,
      departmentId: membership?.department_id ?? null,
      platformAdmin: platformAdminIds.has(authUser.id),
      phoneNumber: profile?.phone_number ?? null,
      createdAt: authUser.created_at ?? profile?.created_at ?? null,
      updatedAt: profile?.updated_at ?? authUser.updated_at ?? null,
      lastActivityAt: authUser.last_sign_in_at ?? null,
    };
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  const ahaReflectionRows: PlatformAdminAhaReflectionRow[] = ahaReflections.map((row) => {
    const userId = String(row.user_id);
    const user = userById.get(userId);
    const profile = profileById.get(userId) ?? null;
    const rawVisibility = safeString(row.visibility, "private");
    const visibility =
      rawVisibility === "department" || rawVisibility === "company"
        ? rawVisibility
        : "private";
    const organizationId = safeString(row.organization_id) || null;
    const moduleId = safeString(row.module_id);
    const fallbackEmail = safeString(profile?.email);
    const fallbackName = safeString(profile?.full_name) || fallbackEmail;
    return {
      id: String(row.id),
      createdAt: safeString(row.created_at),
      userId,
      userName: user?.fullName || fallbackName || "Chưa có tên",
      userEmail: user?.email || fallbackEmail,
      organizationId,
      organizationName: organizationId
        ? organizationNameById.get(organizationId) || null
        : null,
      moduleId,
      moduleTitle: learningModuleTitleById.get(moduleId) || moduleId,
      insight: safeString(row.insight),
      nextAction: safeString(row.next_action) || null,
      visibility,
    };
  });

  const recentActivityThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const organizationDetails: Record<string, PlatformAdminOrganizationDetailRow> = {};

  for (const org of organizationRows) {
    const orgMembers = users
      .filter((user) => user.organizationId === org.id)
      .sort((a, b) => {
        const roleRank = (role: PlatformAdminUserRow["memberRole"]) =>
          role === "owner" ? 0 : role === "manager" ? 1 : 2;
        return roleRank(a.memberRole) - roleRank(b.memberRole) || a.email.localeCompare(b.email);
      });
    const memberRows: PlatformAdminOrganizationMemberRow[] = orgMembers.map((user) => ({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      memberRole: user.memberRole,
      departmentId: user.departmentId,
      platformAdmin: user.platformAdmin,
      learningActivated: user.learningActivated,
      aiLevel: user.aiLevel,
      lastActivityAt: user.lastActivityAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    const activeLearnerCount = orgMembers.filter(
      (user) =>
        user.learningActivated &&
        Boolean(user.lastActivityAt && user.lastActivityAt >= recentActivityThreshold),
    ).length;
    const learningActivatedCount = orgMembers.filter((user) => user.learningActivated).length;
    const averageAiLevel =
      orgMembers.length === 0
        ? 0
        : Math.round(
            orgMembers.reduce((total, user) => total + Number(user.aiLevel ?? 0), 0) /
              orgMembers.length,
          );

    const quizOrgResults = quizResults.filter((row) => {
      const membership = membershipByUser.get(String(row.user_id));
      return membership?.organization_id === org.id;
    });
    const averageQuizScore =
      quizOrgResults.length === 0
        ? 0
        : Math.round(
            quizOrgResults.reduce((total, row) => total + Number(row.score ?? 0), 0) /
              quizOrgResults.length,
          );
    const totalHoursSaved = timeLogs.reduce((total, row) => {
      const membership = membershipByUser.get(String(row.user_id));
      return membership?.organization_id === org.id
        ? total + Number(row.hours_saved ?? 0)
        : total;
    }, 0);
    const assignments = learningAssignments.filter(
      (row) => String(row.organization_id) === org.id,
    ).length;
    const assessmentsCount = assessments.filter(
      (row) => String(row.organization_id) === org.id,
    ).length;
    const gradingQueue = gradingResults.filter(
      (row) => String(row.organization_id) === org.id && safeString(row.review_status, "") === "manager-review",
    ).length;
    const ahaReflectionsCount = ahaReflections.filter(
      (row) => String(row.organization_id) === org.id,
    ).length;

    const lastActivityAt = orgMembers.reduce<string | null>((latest, user) => {
      const candidate = user.lastActivityAt ?? user.updatedAt ?? user.createdAt ?? null;
      if (!candidate) return latest;
      if (!latest) return candidate;
      return candidate > latest ? candidate : latest;
    }, null);

    const adminDirectory = parseOrgAdminDirectory(org.settingsJson);
    const existingAdmins = adminDirectory.length
      ? adminDirectory
      : orgMembers
          .filter((user) => user.memberRole === "owner" || user.memberRole === "manager")
          .map((user) => ({
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            role: memberRoleToOrgAdminRole(user.memberRole),
            departmentId: user.departmentId,
            permissions: defaultOrgAdminPermissions(
              memberRoleToOrgAdminRole(user.memberRole),
            ),
            createdAt: user.createdAt ?? new Date().toISOString(),
            updatedAt: user.updatedAt ?? new Date().toISOString(),
          }));

    organizationDetails[org.id] = {
      organizationId: org.id,
      memberCount: org.memberCount,
      managerCount: org.managerCount,
      employeeCount: org.employeeCount,
      learningActivatedCount,
      activeLearnerCount,
      averageAiLevel,
      quizCount: quizOrgResults.length,
      averageQuizScore,
      totalHoursSaved,
      assignments,
      assessments: assessmentsCount,
      gradingQueue,
      ahaReflections: ahaReflectionsCount,
      lastActivityAt,
      admins: existingAdmins,
      members: memberRows,
    };
  }

  const recentAuditRows = events
    .filter((row) => safeString(row.event_name).startsWith("audit:"))
    .slice(0, 30);

  const audits: PlatformAdminAuditRow[] = recentAuditRows.map((row) => {
    const actor = authById.get(String(row.user_id))?.email ?? String(row.user_id);
    const properties = (row.properties_json ?? {}) as Record<string, unknown>;
    const actionKey =
      safeString(properties.action as string | undefined) ||
      safeString(row.event_name).replace(/^audit:/, "");
    const organizationName =
      safeString(properties.organizationName as string | undefined) ||
      safeString(properties.organization_name as string | undefined) ||
      null;
    const detail = Object.entries(properties)
      .filter(
        ([key]) =>
          ![
            "action",
            "organizationName",
            "organization_name",
            "password",
            "token",
            "secret",
          ].includes(key),
      )
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join(" · ");
    return {
      id: row.id,
      actor,
      action: actionKey,
      actionLabel: getPlatformAdminAuditActionLabel(actionKey),
      detail: detail || "—",
      organizationName,
      at: formatRelativeTime(typeof row.created_at === "string" ? row.created_at : null),
    };
  });

  const quizAvgScore =
    quizResults.length === 0
      ? 0
      : Math.round(
          quizResults.reduce((total, row) => total + Number(row.score ?? 0), 0) /
            quizResults.length,
        );

  const totalHoursSaved = timeLogs.reduce(
    (total, row) => total + Number(row.hours_saved ?? 0),
    0,
  );

  const usedLast7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const usedLast30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const content: PlatformAdminContentRow[] = [
    {
      label: "Learning modules",
      status: "đang chạy",
      count: learningModules.length,
      note: `${learningModules.filter((row) => safeString(row.status, "draft") === "published").length} published`,
    },
    {
      label: "Training modules",
      status: "Phase 2",
      count: trainingModules.length,
      note: `${trainingModules.filter((row) => safeString(row.status, "draft") === "published").length} published`,
    },
    {
      label: "Learning paths",
      status: "Phase 2",
      count: learningPaths.length,
      note: `${learningPaths.filter((row) => safeString(row.status, "draft") === "published").length} published`,
    },
    {
      label: "Assignments",
      status: "active",
      count: learningAssignments.length,
      note: `${learningAssignments.filter((row) => safeString(row.status, "active") === "active").length} active`,
    },
    {
      label: "Assessments",
      status: "published",
      count: assessments.length,
      note: `${assessments.filter((row) => safeString(row.status, "draft") === "published").length} published`,
    },
    {
      label: "Grading queue",
      status: "manager-review",
      count: gradingResults.filter((row) => safeString(row.review_status, "") === "manager-review").length,
      note: "Bài chờ duyệt",
    },
    {
      label: "Aha reflections",
      status: "visible",
      count: ahaReflections.length,
      note: `${ahaReflections.filter((row) => safeString(row.visibility, "private") !== "private").length} shared`,
    },
    {
      label: "Invite links",
      status: "active",
      count: inviteLinks.filter((row) => Boolean(row.is_active)).length,
      note: `${inviteLinks.length} total`,
    },
  ];

  const contentItems: PlatformAdminContentItemRow[] = [
    ...learningModules.map((row) => ({
      collection: "learning_modules" as const,
      id: row.id,
      title: safeString(row.title),
      status: safeString(row.status, "draft"),
      scope: null,
      organizationName: null,
      version: null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })),
    ...trainingModules.map((row) => ({
      collection: "training_modules" as const,
      id: row.id,
      title: safeString(row.title),
      status: safeString(row.status, "draft"),
      scope: safeString(row.scope) || null,
      organizationName: organizationNameById.get(String(row.organization_id)) ?? null,
      version: null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })),
    ...learningPaths.map((row) => ({
      collection: "learning_paths" as const,
      id: row.id,
      title: safeString(row.title),
      status: safeString(row.status, "draft"),
      scope: safeString(row.scope) || null,
      organizationName: organizationNameById.get(String(row.organization_id)) ?? null,
      version: typeof row.version === "number" ? String(row.version) : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })),
    ...assessments.map((row) => ({
      collection: "assessments" as const,
      id: row.id,
      title: safeString(row.title),
      status: safeString(row.status, "draft"),
      scope: safeString(row.assessment_type) || null,
      organizationName: organizationNameById.get(String(row.organization_id)) ?? null,
      version: null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })),
  ].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  const inviteLinkRows: PlatformAdminInviteLinkRow[] = inviteLinks.map((row) => ({
    id: row.id,
    organizationId: String(row.organization_id),
    organizationName: organizationNameById.get(String(row.organization_id)) ?? "Tổ chức",
    createdBy: String(row.created_by),
    token: String(row.token),
    isActive: Boolean(row.is_active),
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
    lastUsedAt: typeof row.last_used_at === "string" ? row.last_used_at : null,
  }));

  const alerts: string[] = [];
  if (organizationRows.length === 0) {
    alerts.push("Chưa có tổ chức nào trong hệ thống.");
  }
  if (users.length === 0) {
    alerts.push("Chưa có user nào trong hệ thống.");
  }
  if (organizationRows.some((org) => org.status !== "active")) {
    alerts.push("Có tổ chức đang bị tạm dừng hoặc lưu trữ.");
  }
  if (gradingResults.filter((row) => safeString(row.review_status, "") === "manager-review").length > 0) {
    alerts.push("Có bài chờ quản lý duyệt.");
  }
  if (chatUsage.filter((row) => typeof row.used_at === "string" && row.used_at >= usedLast30Days).length === 0) {
    alerts.push("30 ngày gần đây chưa ghi nhận chat usage.");
  }

  const report: PlatformAdminConsoleReport = {
    generatedAt: new Date().toISOString(),
    persisted: true,
    platform: {
      supabaseConfigured: true,
      openaiConfigured: isOpenAIConfigured(),
      openaiModel: getOpenAIModel(),
      rateLimitPerDay: getRateLimitPerDay(),
    },
    overview: {
      organizations: organizationRows.length,
      activeOrganizations: organizationRows.filter((row) => row.status === "active").length,
      suspendedOrganizations: organizationRows.filter((row) => row.status === "suspended").length,
      archivedOrganizations: organizationRows.filter((row) => row.status === "archived").length,
      users: users.length,
      platformAdmins: platformAdminIds.size,
      managers: users.filter((user) => user.memberRole === "manager" || user.memberRole === "owner").length,
      employees: users.filter((user) => user.memberRole === "employee" || !user.memberRole).length,
      totalModules: learningModules.length + trainingModules.length,
      publishedModules:
        learningModules.filter((row) => safeString(row.status, "draft") === "published").length +
        trainingModules.filter((row) => safeString(row.status, "draft") === "published").length,
      totalPaths: learningPaths.length,
      publishedPaths: learningPaths.filter((row) => safeString(row.status, "draft") === "published").length,
      assignments: learningAssignments.length,
      assessments: assessments.length,
      gradingQueue: gradingResults.filter((row) => safeString(row.review_status, "") === "manager-review").length,
      ahaReflections: ahaReflections.length,
      leads: leads.length,
      quizCount: quizResults.length,
      quizAvgScore,
      totalHoursSaved,
      chatUsage7d: chatUsage.filter((row) => typeof row.used_at === "string" && row.used_at >= usedLast7Days).length,
      chatUsage30d: chatUsage.filter((row) => typeof row.used_at === "string" && row.used_at >= usedLast30Days).length,
      inviteLinks: inviteLinks.filter((row) => Boolean(row.is_active)).length,
      auditEvents30d: events.filter((row) => typeof row.created_at === "string" && row.created_at >= usedLast30Days).length,
    },
    organizations: organizationRows,
    organizationDetails,
    users: users.sort((a, b) => a.email.localeCompare(b.email)),
    content,
    contentItems,
    ahaReflections: ahaReflectionRows,
    inviteLinks: inviteLinkRows,
    audits,
    alerts,
  };
  return applyPlatformAdminConsoleFilters(report, filters);
}

export type PlatformAdminActionResult = {
  ok: boolean;
  message: string;
  refreshed?: boolean;
  data?: Record<string, unknown>;
};

async function findAuthUserByEmail(
  supabase: SupabaseServiceClient,
  email: string,
): Promise<AuthUserRow | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const users = await listAllAuthUsers(supabase);
  return users.find((user) => user.email?.trim().toLowerCase() === target) ?? null;
}

async function loadActivationTarget(
  supabase: SupabaseServiceClient,
  userId: string,
): Promise<{
  profile: ProfileRow;
  authUser: AuthUserRow | null;
}> {
  const [{ data: profile, error: profileError }, { data: authData, error: authError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, role_id, learning_activated, learning_activated_at, learning_activated_by, activation_email_sent_at",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.auth.admin.getUserById(userId),
    ]);

  if (profileError) {
    throw profileError;
  }
  if (!profile) {
    throw new Error("NOT_FOUND: Không tìm thấy profile người dùng.");
  }
  if (authError) {
    console.warn("[platform-admin:activation]", authError.message);
  }

  return {
    profile: profile as ProfileRow,
    authUser: (authData?.user as AuthUserRow | undefined) ?? null,
  };
}

export async function performPlatformAdminAction(input: {
  action: PlatformAdminAction;
  actorId: string;
  payload: Record<string, unknown>;
}): Promise<PlatformAdminActionResult> {
  const supabase = await getSupabaseServiceClient();
  const action = validatePlatformAdminActionInput(input);

  if (action.action === "toggle-organization-status") {
    const { organizationId, status: nextStatus } = action.payload;
    const { error } = await supabase
      .from("organizations")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", organizationId);
    if (error) throw error;
    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      organizationId,
      status: nextStatus,
    });
    return { ok: true, message: "Đã cập nhật trạng thái tổ chức.", refreshed: true };
  }

  if (action.action === "update-organization") {
    const { organizationId, name, aiTool, settings } = action.payload;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name) patch.name = name;
    if (aiTool) patch.ai_tool = normalizeAiToolValue(aiTool);
    if (settings) {
      patch.settings_json = settings;
    }
    const { error } = await supabase.from("organizations").update(patch).eq("id", organizationId);
    if (error) throw error;
    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      organizationId,
      name: name || undefined,
      aiTool: aiTool || undefined,
    });
    return { ok: true, message: "Đã cập nhật công ty.", refreshed: true };
  }

  if (action.action === "toggle-platform-admin") {
    const { email, enabled } = action.payload;
    const authUser = await findAuthUserByEmail(supabase, email);
    if (!authUser) {
      throw new Error("NOT_FOUND: Không tìm thấy user theo email.");
    }

    if (enabled) {
      const { error } = await supabase.from("platform_admins").upsert(
        { user_id: authUser.id, note: "Cấp quyền qua /van-hanh", created_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    } else {
      const { error } = await supabase.from("platform_admins").delete().eq("user_id", authUser.id);
      if (error) throw error;
    }

    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      userId: authUser.id,
      email,
      enabled,
    });
    return {
      ok: true,
      message: enabled ? "Đã cấp quyền hệ thống." : "Đã thu hồi quyền hệ thống.",
      refreshed: true,
    };
  }

  if (action.action === "create-organization-admin") {
    const {
      organizationId,
      email,
      fullName,
      adminRole,
      departmentId,
      permissions,
    } = action.payload;
    const now = new Date().toISOString();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    const targetMemberRole = orgAdminRoleToMemberRole(adminRole);

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id, name, slug, settings_json")
      .eq("id", organizationId)
      .maybeSingle();
    if (organizationError) throw organizationError;
    if (!organization) {
      throw new Error("NOT_FOUND: Không tìm thấy tổ chức.");
    }

    const existingAuthUser = await findAuthUserByEmail(supabase, normalizedEmail);
    if (existingAuthUser) {
      const { data: existingMembership, error: existingMembershipError } = await supabase
        .from("organization_members")
        .select("organization_id, member_role")
        .eq("user_id", existingAuthUser.id)
        .maybeSingle();
      if (existingMembershipError) throw existingMembershipError;
      if (existingMembership && existingMembership.organization_id !== organizationId) {
        throw new Error("CONFLICT: Tài khoản đã thuộc tổ chức khác.");
      }
    }

    if (existingAuthUser) {
      const { error } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
        email_confirm: true,
        user_metadata: {
          full_name: normalizedName,
        },
      });
      if (error) throw error;
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {
          full_name: normalizedName,
        },
      });
      if (error) throw error;
      if (!created?.user?.id) {
        throw new Error("Không tạo được tài khoản auth.");
      }
    }

    const authUser = (await findAuthUserByEmail(supabase, normalizedEmail)) ?? existingAuthUser;
    if (!authUser) {
      throw new Error("Không xác định được auth user vừa tạo.");
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authUser.id,
      full_name: normalizedName,
      email: normalizedEmail,
      account_type: "company",
      updated_at: now,
    });
    if (profileError) throw profileError;

    const { data: currentMembership, error: membershipLookupError } = await supabase
      .from("organization_members")
      .select("organization_id, member_role, department_id, invited_email, created_at, updated_at")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (membershipLookupError) throw membershipLookupError;
    if (currentMembership && currentMembership.organization_id !== organizationId) {
      throw new Error("CONFLICT: Tài khoản đã thuộc tổ chức khác.");
    }

    const membershipPayload = {
      organization_id: organizationId,
      user_id: authUser.id,
      member_role: targetMemberRole,
      department_id: departmentId ?? "nhan-su",
      invited_email: normalizedEmail,
      invited_at: now,
      updated_at: now,
    };

    if (currentMembership) {
      const { error: membershipUpdateError } = await supabase
        .from("organization_members")
        .update({
          member_role: targetMemberRole,
          department_id: departmentId ?? "nhan-su",
          invited_email: normalizedEmail,
          updated_at: now,
        })
        .eq("organization_id", organizationId)
        .eq("user_id", authUser.id);
      if (membershipUpdateError) throw membershipUpdateError;
    } else {
      const { error: membershipInsertError } = await supabase
        .from("organization_members")
        .insert(membershipPayload);
      if (membershipInsertError) throw membershipInsertError;
    }

    const currentSettings = isRecordValue(organization.settings_json)
      ? { ...organization.settings_json }
      : {};
    const existingDirectory = parseOrgAdminDirectory(currentSettings);
    const nextDirectory = [
      ...existingDirectory.filter((entry) => entry.email.toLowerCase() !== normalizedEmail),
      {
        userId: authUser.id,
        email: normalizedEmail,
        fullName: normalizedName,
        role: adminRole,
        departmentId: departmentId ?? "nhan-su",
        permissions,
        createdAt: existingDirectory.find((entry) => entry.email.toLowerCase() === normalizedEmail)
          ?.createdAt ?? now,
        updatedAt: now,
      },
    ];

    const { error: organizationUpdateError } = await supabase
      .from("organizations")
      .update({
        settings_json: writeOrgAdminDirectory(currentSettings, nextDirectory),
        updated_at: now,
      })
      .eq("id", organizationId);
    if (organizationUpdateError) throw organizationUpdateError;

    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      organizationId,
      userId: authUser.id,
      email: normalizedEmail,
      adminRole,
      permissions,
    });

    const passwordSetupEmailStatus = existingAuthUser
      ? "not-needed"
      : await sendPasswordSetupEmail(supabase, normalizedEmail);
    const passwordSetupHint =
      passwordSetupEmailStatus === "sent"
        ? " Email đặt mật khẩu đã được gửi cho admin mới."
        : passwordSetupEmailStatus === "not-needed"
          ? ""
          : " Tài khoản đã tạo nhưng chưa gửi được email đặt mật khẩu; hãy dùng luồng quên mật khẩu cho email này.";

    return {
      ok: true,
      message: `Đã tạo tài khoản ${adminRole === "super_admin" ? "super-admin" : "admin"} cho tổ chức.${passwordSetupHint}`,
      refreshed: true,
      data: {
        userId: authUser.id,
        passwordSetupEmailStatus,
      },
    };
  }

  if (action.action === "update-user") {
    const {
      userId,
      fullName,
      phoneNumber,
      roleId,
      aiLevel,
      accountType,
      organizationId,
      memberRole,
      departmentId,
      platformAdmin,
      email,
    } = action.payload;
    const patch: Record<string, unknown> = {};
    if (fullName !== undefined) {
      patch.full_name = fullName;
    }
    if (phoneNumber !== undefined) {
      patch.phone_number = phoneNumber;
    }
    if (roleId !== undefined) {
      patch.role_id = roleId;
    }
    if (aiLevel !== undefined) {
      patch.ai_level = aiLevel;
    }
    if (accountType !== undefined) {
      patch.account_type = accountType;
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("profiles").upsert({ id: userId, ...patch });
      if (error) throw error;
    }

    if (roleId !== undefined || aiLevel !== undefined) {
      const { error: cacheError } = await supabase
        .from("learning_recommendations")
        .delete()
        .eq("user_id", userId);
      if (cacheError) throw cacheError;
    }

    if (organizationId && memberRole) {
      const { error } = await supabase
        .from("organization_members")
        .update({
          member_role: memberRole,
          department_id: departmentId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("organization_id", organizationId);
      if (error) throw error;
    }

    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      userId,
      organizationId: organizationId || undefined,
      roleId: roleId || undefined,
      aiLevel: aiLevel ?? undefined,
      memberRole: memberRole || undefined,
      departmentId: departmentId || undefined,
      email: email || undefined,
      platformAdmin: platformAdmin ?? undefined,
    });
    return { ok: true, message: "Đã cập nhật người dùng.", refreshed: true };
  }

  if (action.action === "set-user-activation") {
    const { userId, activated } = action.payload;
    const now = new Date().toISOString();
    const { profile, authUser } = await loadActivationTarget(supabase, userId);
    const wasActivated = Boolean(profile.learning_activated);

    if (activated === wasActivated) {
      await logAuditEvent(input.actorId, "platform_admin.action", {
        action: input.action,
        userId,
        activated,
        noop: true,
      });
      return {
        ok: true,
        message: activated
          ? "Người dùng đã được kích hoạt trước đó."
          : "Người dùng đã ở trạng thái chờ kích hoạt.",
        refreshed: true,
      };
    }

    const patch: Record<string, unknown> = {
      learning_activated: activated,
      updated_at: now,
    };

    let emailStatus = "skipped";
    if (activated) {
      patch.learning_activated_at = now;
      patch.learning_activated_by = input.actorId;
      const recipient = profile.email ?? authUser?.email ?? null;
      const authFullName = safeString(
        (authUser?.user_metadata?.full_name as string | undefined) ?? null,
      );
      const fullName =
        profile.full_name ||
        authFullName ||
        recipient?.split("@")[0] ||
        "bạn";
      if (recipient) {
        const emailResult = await sendPlatformAdminActivationEmail(
          recipient,
          fullName,
          profile.role_id,
        );
        if (emailResult.delivered) {
          patch.activation_email_sent_at = now;
          emailStatus = "sent";
        } else {
          emailStatus = emailResult.detail
            ? `skipped:${emailResult.reason}:${emailResult.detail}`
            : `skipped:${emailResult.reason}`;
        }
      } else {
        emailStatus = "skipped:no_email";
      }
    } else {
      patch.learning_activated_at = null;
      patch.learning_activated_by = null;
    }

    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw error;

    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      userId,
      activated,
      emailStatus,
    });

    const activationMessage = (() => {
      if (!activated) {
        return "Đã chuyển về trạng thái chờ kích hoạt.";
      }
      if (emailStatus === "sent") {
        return "Đã kích hoạt và gửi email thông báo.";
      }
      if (emailStatus.startsWith("skipped:gmail_app_password_required")) {
        return "Đã kích hoạt, nhưng chưa gửi được email: Gmail cần App Password trong SMTP_PASS (không dùng mật khẩu đăng nhập thường).";
      }
      if (emailStatus.startsWith("skipped:smtp_auth_failed")) {
        return "Đã kích hoạt, nhưng chưa gửi được email: SMTP_USER hoặc SMTP_PASS không hợp lệ.";
      }
      if (emailStatus.startsWith("skipped:smtp_not_configured")) {
        return "Đã kích hoạt, nhưng chưa gửi email vì thiếu cấu hình SMTP.";
      }
      return "Đã kích hoạt, nhưng email bị bỏ qua.";
    })();

    return {
      ok: true,
      message: activationMessage,
      refreshed: true,
    };
  }

  if (action.action === "bulk-set-activation") {
    const { userIds, activated, excludePlatformAdmins } = action.payload;
    let targetUserIds = userIds;
    let skippedPlatformAdminIds: string[] = [];

    if (excludePlatformAdmins) {
      const adminRows = await safeSelect<{ user_id: string }>(
        supabase.from("platform_admins").select("user_id"),
      );
      const platformAdminIds = new Set(adminRows.map((row) => row.user_id));
      skippedPlatformAdminIds = userIds.filter((userId) => platformAdminIds.has(userId));
      targetUserIds = userIds.filter((userId) => !platformAdminIds.has(userId));
    }

    const results: Array<{ userId: string; ok: boolean; message: string }> = [];
    for (const userId of targetUserIds) {
      try {
        const single = await performPlatformAdminAction({
          action: "set-user-activation",
          actorId: input.actorId,
          payload: { userId, activated },
        });
        results.push({ userId, ok: single.ok, message: single.message });
      } catch (error) {
        results.push({
          userId,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      activated,
      userIds: targetUserIds,
      count: targetUserIds.length,
      excludePlatformAdmins: excludePlatformAdmins || undefined,
      skippedPlatformAdminIds,
    });

    return {
      ok: true,
      message: activated
        ? `Đã kích hoạt ${results.filter((result) => result.ok).length}/${targetUserIds.length} người dùng.`
        : `Đã huỷ kích hoạt ${results.filter((result) => result.ok).length}/${targetUserIds.length} người dùng${skippedPlatformAdminIds.length > 0 ? `, bỏ qua ${skippedPlatformAdminIds.length} admin` : ""}.`,
      refreshed: true,
      data: { results, skippedPlatformAdminIds },
    };
  }

  if (action.action === "delete-users") {
    const { userIds, confirmUserCount, excludePlatformAdmins } = action.payload;
    const normalizedUserIds = Array.from(new Set(userIds));
    if (normalizedUserIds.includes(input.actorId)) {
      throw new Error("VALIDATION: Không thể xoá chính tài khoản đang đăng nhập.");
    }

    const adminRows = await safeSelect<{ user_id: string }>(
      supabase.from("platform_admins").select("user_id"),
    );
    const platformAdminIds = new Set(adminRows.map((row) => row.user_id));
    const shouldExcludePlatformAdmins = excludePlatformAdmins !== false;
    const skippedPlatformAdminIds = shouldExcludePlatformAdmins
      ? normalizedUserIds.filter((userId) => platformAdminIds.has(userId))
      : [];
    const targetUserIds = shouldExcludePlatformAdmins
      ? normalizedUserIds.filter((userId) => !platformAdminIds.has(userId))
      : normalizedUserIds;

    if (targetUserIds.length !== confirmUserCount) {
      throw new Error(
        `VALIDATION: Số tài khoản xác nhận (${confirmUserCount}) không khớp số tài khoản sẽ xoá (${targetUserIds.length}).`,
      );
    }
    if (targetUserIds.length > MAX_DELETE_USERS_PER_ACTION) {
      throw new Error(
        `VALIDATION: Chỉ được xoá tối đa ${MAX_DELETE_USERS_PER_ACTION} tài khoản mỗi lần.`,
      );
    }

    if (targetUserIds.length === 0) {
      return {
        ok: true,
        message: "Không có tài khoản hợp lệ để xoá.",
        refreshed: true,
        data: { skippedPlatformAdminIds },
      };
    }

    // Delete the auth user and let Postgres FK `ON DELETE CASCADE` remove all
    // child rows (profiles + every user_id-scoped table) in one atomic step.
    // Manual per-table deletes were non-atomic: a single failing/non-existent
    // table left a half-deleted account with no rollback. Each user is deleted
    // independently so one failure stops the batch without partial-deleting a row.
    for (const userId of targetUserIds) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
    }

    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      userIds: targetUserIds,
      count: targetUserIds.length,
      confirmUserCount,
      skippedPlatformAdminIds: skippedPlatformAdminIds.length > 0 ? skippedPlatformAdminIds : undefined,
    });

    return {
      ok: true,
      message: `Đã xoá ${targetUserIds.length} tài khoản.`,
      refreshed: true,
      data: { skippedPlatformAdminIds },
    };
  }

  if (action.action === "reset-user-learning") {
    const { userId, scope } = action.payload;
    if (scope === "learning_recommendations") {
      const { error } = await supabase.from("learning_recommendations").delete().eq("user_id", userId);
      if (error) throw error;
    } else {
      await Promise.all([
        supabase.from("module_progress").delete().eq("user_id", userId),
        supabase.from("quiz_results").delete().eq("user_id", userId),
        supabase.from("time_logs").delete().eq("user_id", userId),
        supabase.from("chat_usage").delete().eq("user_id", userId),
        supabase.from("chat_conversations").delete().eq("user_id", userId),
        supabase.from("chat_memories").delete().eq("user_id", userId),
        supabase.from("aha_reflections").delete().eq("user_id", userId),
        supabase.from("points_ledger").delete().eq("user_id", userId),
        supabase.from("learning_assignments").delete().eq("user_id", userId),
        supabase.from("learning_recommendations").delete().eq("user_id", userId),
      ]);
    }
    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      userId,
      scope: scope || undefined,
    });
    return {
      ok: true,
      message:
        scope === "learning_recommendations"
          ? "Đã xoá cache lộ trình của user."
          : "Đã xoá dữ liệu học tập của user.",
      refreshed: true,
    };
  }

  if (action.action === "set-content-status") {
    const { collection, id, status } = action.payload;
    const table = collection;
    const { error } = await supabase
      .from(table)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      collection,
      id,
      status,
    });
    return { ok: true, message: "Đã cập nhật trạng thái nội dung.", refreshed: true };
  }

  if (action.action === "rotate-invite-link") {
    const { organizationId } = action.payload;
    const { error: deactivateError } = await supabase
      .from("organization_invite_links")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    if (deactivateError) throw deactivateError;

    const token = randomBytes(24).toString("base64url");
    const { data, error } = await supabase
      .from("organization_invite_links")
      .insert({
        organization_id: organizationId,
        created_by: input.actorId,
        token,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select("id, token, organization_id, created_at, updated_at")
      .single();
    if (error) throw error;
    await logAuditEvent(input.actorId, "platform_admin.action", {
      action: input.action,
      organizationId,
    });
    return {
      ok: true,
      message: "Đã xoay link mời cho tổ chức.",
      refreshed: true,
      data: {
        inviteLinkId: data.id,
        token,
      },
    };
  }

  throw new Error("VALIDATION: Hành động không được hỗ trợ.");
}
