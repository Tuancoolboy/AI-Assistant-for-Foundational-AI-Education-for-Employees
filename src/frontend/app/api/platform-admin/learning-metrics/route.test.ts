import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformAdminContext: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/platform-admin-auth", () => ({
  requirePlatformAdminContext: mocks.requirePlatformAdminContext,
}));

vi.mock("@/lib/supabase/is-configured", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

describe("GET /api/platform-admin/learning-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformAdminContext.mockResolvedValue({
      userId: "admin",
      mode: "supabase",
    });
  });

  it("returns only learners active during the selected Vietnam calendar day", async () => {
    const rowsByTable: Record<string, unknown[]> = {
      profiles: [
        {
          id: "user-a",
          full_name: "Người A",
          email: "a@example.com",
          role_id: "nhan-su",
          learning_activated: true,
        },
        {
          id: "user-b",
          full_name: "Người B",
          email: "b@example.com",
          role_id: "nhan-su",
          learning_activated: true,
        },
        {
          id: "user-c",
          full_name: "Người C",
          email: "c@example.com",
          role_id: "nhan-su",
          learning_activated: true,
        },
        {
          id: "user-d",
          full_name: "Người D",
          email: null,
          role_id: "nhan-su",
          learning_activated: true,
        },
      ],
      module_progress: [
        {
          user_id: "user-a",
          status: "hoan-thanh",
          completed_at: "2026-06-24T03:00:00.000Z",
        },
      ],
      events: [
        {
          user_id: "user-b",
          event_name: "lesson_view",
          properties_json: {},
          created_at: "2026-06-24T16:59:59.000Z",
        },
        {
          user_id: "user-c",
          event_name: "lesson_view",
          properties_json: {},
          created_at: "2026-06-24T17:00:00.000Z",
        },
        {
          user_id: "user-d",
          event_name: "lesson_view",
          properties_json: {},
          created_at: "2026-06-24T04:00:00.000Z",
        },
      ],
      user_learning_selection: [],
      generated_learning_paths: [],
      quiz_results: [],
      chat_usage: [],
      time_logs: [],
      points_ledger: [],
    };

    mocks.createSupabaseServiceClient.mockReturnValue({
      from: (table: string) => ({
        select: () => {
          const result = { data: rowsByTable[table] ?? [] };
          if (table === "events") {
            return {
              limit: vi.fn().mockResolvedValue(result),
            };
          }
          return Promise.resolve(result);
        },
      }),
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: {
              users: [
                { id: "user-a", last_sign_in_at: "2026-06-25T01:00:00.000Z" },
                { id: "user-b", last_sign_in_at: null },
                { id: "user-c", last_sign_in_at: null },
                { id: "user-d", email: "d@example.com", last_sign_in_at: null },
              ],
            },
          }),
        },
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/platform-admin/learning-metrics?from=2026-06-24&to=2026-06-24",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows.map((row: { userId: string }) => row.userId)).toEqual([
      "user-a",
      "user-b",
      "user-d",
    ]);
    expect(body.rows.find((row: { userId: string }) => row.userId === "user-d").email).toBe(
      "d@example.com",
    );
    expect(body.summary.totalUsers).toBe(3);
    expect(body.summary.totalCompleted).toBe(1);
    expect(body.completedByDate).toEqual([
      {
        date: "2026-06-24",
        completedCount: 1,
        activeLearners: 1,
        hoursSaved: 0,
        activityCount: 1,
      },
    ]);
    expect(body.rows[0].lastActivityAt).toBe("2026-06-25T01:00:00.000Z");
  });
});
