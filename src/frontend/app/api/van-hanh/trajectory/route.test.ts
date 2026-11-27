import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformAdminContext: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/platform-admin-auth", () => ({
  requirePlatformAdminContext: mocks.requirePlatformAdminContext,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

describe("GET /api/van-hanh/trajectory", () => {
  const studentA = "11111111-1111-4111-8111-111111111111";
  const studentB = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createSupabaseServiceClient.mockReturnValue({
      rpc: mocks.rpc,
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      select: mocks.select,
    });

    mocks.select.mockReturnValue({
      eq: mocks.eq,
    });

    mocks.eq.mockReturnValue({
      order: mocks.order,
    });
  });

  it("returns FORBIDDEN if not platform admin", async () => {
    mocks.requirePlatformAdminContext.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api?studentId=123"));
    const body = await response.json();
    
    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns VALIDATION_ERROR if missing studentId", async () => {
    mocks.requirePlatformAdminContext.mockResolvedValue({ userId: "admin1", mode: "supabase" });
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api?targetTime=2026-01-01"));
    const body = await response.json();
    
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR if studentId is not a UUID", async () => {
    mocks.requirePlatformAdminContext.mockResolvedValue({ userId: "admin1", mode: "supabase" });
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api?studentId=u1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("calls rpc get_student_trajectory_at if targetTime is provided", async () => {
    mocks.requirePlatformAdminContext.mockResolvedValue({ userId: "admin1", mode: "supabase" });
    mocks.rpc.mockResolvedValue({ data: [{ id: "1", edge_type: "COMPLETED" }], error: null });

    const { GET } = await import("./route");
    const response = await GET(new Request(`http://localhost/api?studentId=${studentA}&targetTime=2026-06-24T00:00:00Z`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("get_student_trajectory_at", {
      p_student_id: studentA,
      p_target_time: "2026-06-24T00:00:00Z",
    });
    expect(body.edges).toEqual([{ id: "1", edge_type: "COMPLETED" }]);
  });

  it("calls from temporal_knowledge_edges if no targetTime", async () => {
    mocks.requirePlatformAdminContext.mockResolvedValue({ userId: "admin1", mode: "supabase" });
    mocks.order.mockResolvedValue({ data: [{ id: "2", edge_type: "STRUGGLED" }], error: null });

    const { GET } = await import("./route");
    const response = await GET(new Request(`http://localhost/api?studentId=${studentB}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith("temporal_knowledge_edges");
    expect(mocks.select).toHaveBeenCalledWith("*");
    expect(mocks.eq).toHaveBeenCalledWith("student_id", studentB);
    expect(mocks.order).toHaveBeenCalledWith("valid_from", { ascending: true });
    expect(body.edges).toEqual([{ id: "2", edge_type: "STRUGGLED" }]);
  });
});
