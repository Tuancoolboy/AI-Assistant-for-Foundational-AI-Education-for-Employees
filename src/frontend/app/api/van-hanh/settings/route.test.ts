import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformAdminContext: vi.fn(),
  getSiteSettings: vi.fn(),
  updateSiteSettings: vi.fn(),
}));

vi.mock("@/lib/platform-admin-auth", () => ({
  requirePlatformAdminContext: mocks.requirePlatformAdminContext,
}));

vi.mock("@/lib/site-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/site-settings")>();
  return {
    ...actual,
    getSiteSettings: mocks.getSiteSettings,
    updateSiteSettings: mocks.updateSiteSettings,
  };
});

describe("API /api/van-hanh/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 403 if not platform admin", async () => {
      mocks.requirePlatformAdminContext.mockResolvedValue(null);

      const { GET } = await import("./route");
      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns settings object if platform admin", async () => {
      mocks.requirePlatformAdminContext.mockResolvedValue({
        userId: "admin-1",
        mode: "supabase",
      });
      const mockSettings = {
        enable_chat_eval: true,
        chat_model: "gpt-4o",
      };
      mocks.getSiteSettings.mockResolvedValue(mockSettings);

      const { GET } = await import("./route");
      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.enable_chat_eval).toBe(true);
      expect(body.chat_model).toBe("gpt-4o");
    });
  });

  describe("PUT", () => {
    it("returns 403 if not platform admin", async () => {
      mocks.requirePlatformAdminContext.mockResolvedValue(null);

      const { PUT } = await import("./route");
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          body: JSON.stringify({ enable_chat_eval: true }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 and blocks writes if in demo mode", async () => {
      mocks.requirePlatformAdminContext.mockResolvedValue({
        userId: "demo-user",
        mode: "demo",
      });

      const { PUT } = await import("./route");
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          body: JSON.stringify({ enable_chat_eval: true }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("Demo mode");
      expect(mocks.updateSiteSettings).not.toHaveBeenCalled();
    });

    it("calls updateSiteSettings with whitelisted fields and returns success", async () => {
      mocks.requirePlatformAdminContext.mockResolvedValue({
        userId: "admin-1",
        mode: "supabase",
      });
      mocks.updateSiteSettings.mockResolvedValue(undefined);

      const { PUT } = await import("./route");
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          body: JSON.stringify({
            enable_chat_eval: true,
            chat_model: "gpt-4o",
            invalid_field: "hack",
            faithfulness_alert_threshold: 0.85,
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.success).toBe(true);
      expect(body.updated).toEqual(expect.arrayContaining([
        "enable_chat_eval",
        "faithfulness_alert_threshold",
        "chat_model",
      ]));
      expect(mocks.updateSiteSettings).toHaveBeenCalledWith(
        {
          enable_chat_eval: true,
          chat_model: "gpt-4o",
          faithfulness_alert_threshold: 0.85,
        },
        "admin-1",
      );
    });

    it("returns 400 if no valid fields found in body", async () => {
      mocks.requirePlatformAdminContext.mockResolvedValue({
        userId: "admin-1",
        mode: "supabase",
      });

      const { PUT } = await import("./route");
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          body: JSON.stringify({
            invalid_field: "hack",
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(mocks.updateSiteSettings).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid direct API writes to supported fields", async () => {
      mocks.requirePlatformAdminContext.mockResolvedValue({
        userId: "admin-1",
        mode: "supabase",
      });

      const { PUT } = await import("./route");
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          body: JSON.stringify({
            chat_model: "not-a-real-model",
            daily_message_limit: -1,
            max_context_tokens: 999999,
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("chat_model");
      expect(body.error.message).toContain("daily_message_limit");
      expect(body.error.message).toContain("max_context_tokens");
      expect(mocks.updateSiteSettings).not.toHaveBeenCalled();
    });
  });
});
