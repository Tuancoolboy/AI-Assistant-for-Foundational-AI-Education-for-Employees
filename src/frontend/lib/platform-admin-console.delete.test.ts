import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

function noopDelete() {
  return {
    eq: async () => ({ data: null, error: null }),
  };
}

function buildServiceClient(platformAdminIds: string[] = []) {
  const authDeleteUser = vi.fn(async () => ({ data: { user: { id: "deleted-user" } }, error: null }));
  return {
    authDeleteUser,
    from: (table: string) => {
      if (table === "platform_admins") {
        return {
          select: async () => ({
            data: platformAdminIds.map((userId) => ({ user_id: userId })),
            error: null,
          }),
          delete: () => noopDelete(),
        };
      }
      return {
        delete: () => noopDelete(),
      };
    },
    auth: {
      admin: {
        deleteUser: authDeleteUser,
      },
    },
  };
}

describe("platform-admin delete actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hard-deletes selected users and skips platform admins by default", async () => {
    const client = buildServiceClient(["admin-1"]);
    mocks.createSupabaseServiceClient.mockReturnValue(client);

    const { performPlatformAdminAction } = await import("./platform-admin-console");
    const result = await performPlatformAdminAction({
      action: "delete-users",
      actorId: "actor-1",
      payload: {
        userIds: ["user-1", "admin-1"],
        confirmUserCount: 1,
        excludePlatformAdmins: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("1 tài khoản");
    expect(result.data?.skippedPlatformAdminIds).toEqual(["admin-1"]);
    expect(client.authDeleteUser).toHaveBeenCalledWith("user-1");
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      "actor-1",
      "platform_admin.action",
      expect.objectContaining({
        action: "delete-users",
        count: 1,
        userIds: ["user-1"],
      }),
    );
  });

  it("rejects deleting the current actor", async () => {
    mocks.createSupabaseServiceClient.mockReturnValue(buildServiceClient());

    const { performPlatformAdminAction } = await import("./platform-admin-console");

    await expect(
      performPlatformAdminAction({
        action: "delete-users",
        actorId: "actor-1",
        payload: {
          userIds: ["actor-1"],
          confirmUserCount: 1,
          excludePlatformAdmins: false,
        },
      }),
    ).rejects.toThrow(/Không thể xoá chính tài khoản/);
  });

  it("allows explicit platform-admin deletion", async () => {
    const client = buildServiceClient(["admin-1"]);
    mocks.createSupabaseServiceClient.mockReturnValue(client);

    const { performPlatformAdminAction } = await import("./platform-admin-console");
    const result = await performPlatformAdminAction({
      action: "delete-users",
      actorId: "actor-1",
      payload: {
        userIds: ["admin-1"],
        confirmUserCount: 1,
        excludePlatformAdmins: false,
      },
    });

    expect(result.ok).toBe(true);
    expect(client.authDeleteUser).toHaveBeenCalledWith("admin-1");
  });

  it("rejects when confirmed count differs from the actual delete set", async () => {
    const client = buildServiceClient(["admin-1"]);
    mocks.createSupabaseServiceClient.mockReturnValue(client);

    const { performPlatformAdminAction } = await import("./platform-admin-console");

    await expect(
      performPlatformAdminAction({
        action: "delete-users",
        actorId: "actor-1",
        payload: {
          userIds: ["user-1", "admin-1"],
          confirmUserCount: 2,
          excludePlatformAdmins: true,
        },
      }),
    ).rejects.toThrow(/không khớp/);
    expect(client.authDeleteUser).not.toHaveBeenCalled();
  });
});
