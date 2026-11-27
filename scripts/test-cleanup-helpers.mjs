import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const TEST_EMAIL_SUFFIX = "@test.local";
let exitCleanupRegistered = false;

export function loadEnvLocal(path = ".env.local") {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function registerTestCleanupOnExit() {
  if (exitCleanupRegistered) return;
  exitCleanupRegistered = true;

  process.once("exit", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/cleanup-test-accounts.mjs"],
      {
        cwd: process.cwd(),
        env: { ...process.env, TEST_CLEANUP_FROM_EXIT: "1" },
        stdio: "inherit",
      },
    );
    if (result.status && result.status !== 0) {
      console.warn("[test-cleanup] cleanup-test-accounts exited with non-zero status");
    }
  });
}

function isMissingTableOrColumn(error) {
  return error?.code === "42P01" || error?.code === "42703";
}

function normalizeError(error) {
  return error?.message ?? String(error);
}

async function safeSelect(label, buildQuery, fallback = []) {
  const { data, error } = await buildQuery();
  if (error) {
    if (!isMissingTableOrColumn(error)) {
      console.warn(`[test-cleanup] Không đọc được ${label}: ${normalizeError(error)}`);
    }
    return fallback;
  }
  return data ?? fallback;
}

async function safeDelete(label, buildQuery) {
  const { error, count } = await buildQuery();
  if (error) {
    if (!isMissingTableOrColumn(error)) {
      console.warn(`[test-cleanup] Không xoá được ${label}: ${normalizeError(error)}`);
    }
    return 0;
  }
  return count ?? 0;
}

async function deleteByIds(admin, table, column, ids, label) {
  if (!ids.length) return 0;
  return safeDelete(label, () =>
    admin.from(table).delete({ count: "exact" }).in(column, ids),
  );
}

async function listAllTestAuthUsers(admin) {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw new Error(error.message);

    const pageUsers = data.users ?? [];
    users.push(
      ...pageUsers.filter((user) =>
        user.email?.toLowerCase().endsWith(TEST_EMAIL_SUFFIX),
      ),
    );
    if (pageUsers.length < 100) break;
  }
  return users;
}

export async function cleanupTestArtifacts({ log = true } = {}) {
  loadEnvLocal();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    if (log) {
      console.log("Supabase không được cấu hình. Bỏ qua dọn dẹp test accounts.");
    }
    return {
      deletedAuthUsers: 0,
      deletedProfiles: 0,
      deletedOrganizations: 0,
      deletedMemberships: 0,
      deletedInviteLinks: 0,
      errors: 0,
    };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ""),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const testUsers = await listAllTestAuthUsers(admin);
  const userIds = [...new Set(testUsers.map((user) => user.id).filter(Boolean))];

  const testProfiles = await safeSelect("profiles @test.local", () =>
    admin.from("profiles").select("id").ilike("email", `%${TEST_EMAIL_SUFFIX}`),
  );
  const profileIds = [
    ...new Set([...userIds, ...testProfiles.map((profile) => profile.id).filter(Boolean)]),
  ];

  const orgsByName = await safeSelect("organizations test name", () =>
    admin.from("organizations").select("id").ilike("name", `%${TEST_EMAIL_SUFFIX}%`),
  );
  const orgsByCreator = userIds.length
    ? await safeSelect("organizations created_by", () =>
        admin.from("organizations").select("id").in("created_by", userIds),
      )
    : [];
  const organizationIds = [
    ...new Set(
      [...orgsByName, ...orgsByCreator]
        .map((organization) => organization.id)
        .filter(Boolean),
    ),
  ];

  let errors = 0;
  let deletedAuthUsers = 0;

  const deletedInviteLinks =
    (await deleteByIds(
      admin,
      "organization_invite_links",
      "created_by",
      userIds,
      "organization_invite_links.created_by",
    )) +
    (await deleteByIds(
      admin,
      "organization_invite_links",
      "organization_id",
      organizationIds,
      "organization_invite_links.organization_id",
    ));

  const deletedMemberships =
    (await deleteByIds(
      admin,
      "organization_members",
      "user_id",
      userIds,
      "organization_members.user_id",
    )) +
    (await deleteByIds(
      admin,
      "organization_members",
      "organization_id",
      organizationIds,
      "organization_members.organization_id",
    )) +
    (await safeDelete("organization_members.invited_email", () =>
      admin
        .from("organization_members")
        .delete({ count: "exact" })
        .ilike("invited_email", `%${TEST_EMAIL_SUFFIX}`),
    ));

  const deletedOrganizations = await deleteByIds(
    admin,
    "organizations",
    "id",
    organizationIds,
    "organizations.id",
  );

  const deletedProfiles = await deleteByIds(
    admin,
    "profiles",
    "id",
    profileIds,
    "profiles.id",
  );

  for (const user of testUsers) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      errors += 1;
      console.error(`[test-cleanup] Lỗi khi xoá ${user.email}: ${error.message}`);
    } else {
      deletedAuthUsers += 1;
    }
  }

  const result = {
    deletedAuthUsers,
    deletedProfiles,
    deletedOrganizations,
    deletedMemberships,
    deletedInviteLinks,
    errors,
  };

  if (log) {
    console.log(
      [
        "Hoàn tất dọn dẹp test data:",
        `${deletedAuthUsers} auth users`,
        `${deletedProfiles} profiles`,
        `${deletedOrganizations} organizations`,
        `${deletedMemberships} memberships`,
        `${deletedInviteLinks} invite links`,
      ].join(" · "),
    );
    if (errors > 0) {
      console.warn(`(Có ${errors} tài khoản không thể xoá được)`);
    }
  }

  return result;
}
