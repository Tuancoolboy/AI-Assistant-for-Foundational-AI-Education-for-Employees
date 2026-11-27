import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveApiSession: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  resolveApiSession: mocks.resolveApiSession,
}));

vi.mock("@/lib/supabase/is-configured", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

type QueryStage = {
  table: string;
  maybeSingleData?: unknown;
  inData?: unknown[];
};

type InCall = {
  table: string;
  column: string;
  values: string[];
};

function createMockClient(stages: QueryStage[], inCalls: InCall[]) {
  let call = 0;

  return {
    from: vi.fn((table: string) => {
      const stage = stages[call];
      call += 1;

      if (!stage || stage.table !== table) {
        return {
          select: vi.fn(() => ({ data: null, error: new Error("No mock") })),
          eq: vi.fn(() => ({ data: null, error: new Error("No mock") })),
          maybeSingle: vi.fn(async () => ({ data: null })),
          in: vi.fn(async () => ({ data: [], error: new Error("No mock") })),
        };
      }

      const query: {
        select: () => unknown;
        eq: () => unknown;
        maybeSingle: () => Promise<{ data: unknown; error: null }>;
        in: (_: string, __: string[]) => Promise<{ data: unknown[]; error: null }>;
      } = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: stage.maybeSingleData ?? null,
          error: null,
        })),
        in: vi.fn(async (column: string, values: string[]) => {
          inCalls.push({ table, column, values });
          return { data: stage.inData ?? [], error: null };
        }),
      };

      return query;
    }),
  };
}

describe("/api/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.resolveApiSession.mockResolvedValue({
      mode: "supabase",
      userId: "u-self",
    });
  });

  it("chỉ trả dữ liệu chính mình nếu người dùng chưa thuộc tổ chức", async () => {
    const inCalls: InCall[] = [];
    const mockClient = createMockClient(
      [
        {
          table: "organization_members",
          maybeSingleData: null,
        },
        {
          table: "profiles",
          inData: [{ id: "u-self", full_name: "Bạn", email: "you@example.com" }],
        },
        {
          table: "points_ledger",
          inData: [
            {
              user_id: "u-self",
              points: 120,
              created_at: new Date().toISOString(),
            },
          ],
        },
        {
          table: "time_logs",
          inData: [{ user_id: "u-self", hours_saved: 3.5 }],
        },
      ],
      inCalls,
    );

    mocks.createSupabaseServiceClient.mockReturnValue(mockClient);
    const { GET } = await import("./route");
    const response = await GET();
    const json = (await response.json()) as {
      ok: boolean;
      rows: Array<{ id: string; isYou: boolean; department: string; name: string }>;
      youDepartment: string;
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.rows).toHaveLength(1);
    expect(json.rows[0]?.id).toBe("u-self");
    expect(json.rows[0]?.isYou).toBe(true);
    expect(json.rows[0]?.name).toBe("Bạn");
    expect(json.rows[0]?.department).toBe("Chưa có phòng");
    expect(json.youDepartment).toBe("Chưa có phòng");

    const serviceClient = mocks.createSupabaseServiceClient.mock.results[0]?.value as {
      from: ReturnType<typeof vi.fn>;
    };
    const fromCalls = serviceClient.from.mock.calls as Array<[string]>;
    expect(fromCalls).toEqual([
      ["organization_members"],
      ["profiles"],
      ["points_ledger"],
      ["time_logs"],
    ]);

    const inByTable = Object.fromEntries(inCalls.map((call) => [call.table, call.values]));
    expect(inByTable.profiles).toEqual(["u-self"]);
    expect(inByTable.points_ledger).toEqual(["u-self"]);
    expect(inByTable.time_logs).toEqual(["u-self"]);
  });
});
