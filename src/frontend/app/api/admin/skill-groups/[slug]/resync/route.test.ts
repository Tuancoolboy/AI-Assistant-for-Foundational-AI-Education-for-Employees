import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformAdminContext: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

vi.mock("@/lib/platform-admin-auth", () => ({
  requirePlatformAdminContext: mocks.requirePlatformAdminContext,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

vi.mock("@/lib/supabase/is-configured", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

import { POST } from "./route";

function buildQuery(data: unknown[] = []) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    insert: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };
  return query;
}

describe("/api/admin/skill-groups/[slug]/resync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformAdminContext.mockResolvedValue({
      mode: "supabase",
      userId: "admin-1",
    });
    mocks.isSupabaseConfigured.mockReturnValue(true);
  });

  it("queries learning_modules with the canonical published column", async () => {
    const modulesQuery = buildQuery([]);
    const usersQuery = buildQuery([]);
    const from = vi.fn((table: string) => {
      if (table === "learning_modules") return modulesQuery;
      if (table === "user_skill_groups") return usersQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mocks.createSupabaseServiceClient.mockReturnValue({ from });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "hr-nen-tang" }),
    });
    const json = (await response.json()) as { ok: boolean };

    expect(json.ok).toBe(true);
    expect(modulesQuery.eq).toHaveBeenCalledWith("skill_slug", "hr-nen-tang");
    expect(modulesQuery.eq).toHaveBeenCalledWith("published", true);
    expect(modulesQuery.eq).not.toHaveBeenCalledWith("is_published", true);
  });
});
