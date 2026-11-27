import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  clearSettingsCache,
  getSetting,
  getSiteSettings,
  updateSiteSettings,
  validateSiteSettingsPatch,
} from "./site-settings";

vi.mock("@/lib/supabase/server", () => {
  const mockSelect = vi.fn();
  const mockUpsert = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
  });

  return {
    createSupabaseServiceClient: vi.fn().mockReturnValue({
      from: mockFrom,
    }),
  };
});

describe("site-settings service", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearSettingsCache();
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("should return default values from process.env when DB fails or is offline", async () => {
    process.env.ENABLE_CHAT_EVAL = "true";
    process.env.OPENAI_MODEL = "gpt-custom-model";
    process.env.RATE_LIMIT_PER_DAY = "45";

    const mockClient = createSupabaseServiceClient();
    vi.mocked(mockClient.from("site_settings").select).mockResolvedValue({
      data: null,
      error: { message: "Table site_settings does not exist" },
    } as unknown as never);

    const settings = await getSiteSettings();
    expect(settings.enable_chat_eval).toBe(true);
    expect(settings.chat_model).toBe("gpt-custom-model");
    expect(settings.daily_message_limit).toBe(45);
    expect(settings.faithfulness_alert_threshold).toBe(0.7);
  });

  it("should merge database values over defaults successfully", async () => {
    const mockClient = createSupabaseServiceClient();
    vi.mocked(mockClient.from("site_settings").select).mockResolvedValue({
      data: [
        { key: "enable_chat_eval", value: true },
        { key: "chat_model", value: "gpt-4o-mini" },
        { key: "daily_message_limit", value: 99 },
      ],
      error: null,
    } as unknown as never);

    const settings = await getSiteSettings();
    expect(settings.enable_chat_eval).toBe(true);
    expect(settings.chat_model).toBe("gpt-4o-mini");
    expect(settings.daily_message_limit).toBe(99);
    // Unspecified in DB should use default
    expect(settings.max_history_messages).toBe(10);
  });

  it("should ignore invalid database values and keep safe defaults", async () => {
    process.env.OPENAI_MODEL = "gpt-env-default";

    const mockClient = createSupabaseServiceClient();
    vi.mocked(mockClient.from("site_settings").select).mockResolvedValue({
      data: [
        { key: "chat_model", value: "invalid-model-from-db" },
        { key: "daily_message_limit", value: -1 },
        { key: "max_context_tokens", value: 999999 },
        { key: "max_history_messages", value: 0 },
        { key: "faithfulness_alert_threshold", value: 3 },
      ],
      error: null,
    } as unknown as never);

    const settings = await getSiteSettings();

    expect(settings.chat_model).toBe("gpt-env-default");
    expect(settings.daily_message_limit).toBe(30);
    expect(settings.max_context_tokens).toBe(8000);
    expect(settings.max_history_messages).toBe(10);
    expect(settings.faithfulness_alert_threshold).toBe(0.7);
  });

  it("should validate API patches with model whitelist and numeric bounds", () => {
    const result = validateSiteSettingsPatch({
      enable_chat_eval: false,
      chat_model: "gpt-4o-mini",
      max_context_tokens: 16000,
      max_history_messages: 12,
      daily_message_limit: 0,
      faithfulness_alert_threshold: 0.4,
    });

    expect(result.errors).toEqual([]);
    expect(result.patch).toMatchObject({
      enable_chat_eval: false,
      chat_model: "gpt-4o-mini",
      max_context_tokens: 16000,
      max_history_messages: 12,
      daily_message_limit: 0,
      faithfulness_alert_threshold: 0.4,
    });
  });

  it("should reject unsafe API patch values", () => {
    const result = validateSiteSettingsPatch({
      chat_model: "custom-unknown-model",
      max_context_tokens: 999999,
      max_history_messages: 0,
      daily_message_limit: 1.5,
      faithfulness_alert_threshold: -0.1,
    });

    expect(result.patch).toEqual({});
    expect(result.errors).toHaveLength(5);
  });

  it("should cache values and not query DB repeatedly within TTL", async () => {
    const mockClient = createSupabaseServiceClient();
    const selectMock = vi
      .mocked(mockClient.from("site_settings").select)
      .mockResolvedValue({
        data: [{ key: "chat_model", value: "o1-mini" }],
        error: null,
      } as unknown as never);

    // Call first time
    const settings1 = await getSiteSettings();
    expect(settings1.chat_model).toBe("o1-mini");
    expect(selectMock).toHaveBeenCalledTimes(1);

    // Call second time immediately - should use cache
    const settings2 = await getSiteSettings();
    expect(settings2.chat_model).toBe("o1-mini");
    expect(selectMock).toHaveBeenCalledTimes(1);

    // Invalidate cache
    clearSettingsCache();

    // Call third time - should query DB again
    const settings3 = await getSiteSettings();
    expect(settings3.chat_model).toBe("o1-mini");
    expect(selectMock).toHaveBeenCalledTimes(2);
  });

  it("should allow getting a single setting key", async () => {
    const mockClient = createSupabaseServiceClient();
    vi.mocked(mockClient.from("site_settings").select).mockResolvedValue({
      data: [{ key: "max_history_messages", value: 25 }],
      error: null,
    } as unknown as never);

    const val = await getSetting("max_history_messages");
    expect(val).toBe(25);
  });

  it("should update settings in DB and clear cache", async () => {
    const mockClient = createSupabaseServiceClient();
    const selectMock = vi
      .mocked(mockClient.from("site_settings").select)
      .mockResolvedValue({
        data: [{ key: "chat_model", value: "gpt-4o-mini" }],
        error: null,
      } as unknown as never);

    const upsertMock = vi
      .mocked(mockClient.from("site_settings").upsert)
      .mockResolvedValue({ error: null } as unknown as never);

    // Load initial settings to cache it
    await getSiteSettings();
    expect(selectMock).toHaveBeenCalledTimes(1);

    // Update settings
    await updateSiteSettings({ chat_model: "gpt-4o" }, "user-uuid");
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith([
      {
        key: "chat_model",
        value: "gpt-4o",
        updated_at: expect.any(String),
        updated_by: "user-uuid",
      },
    ]);

    // Query again, should query DB (not cache) because update cleared cache
    vi.mocked(mockClient.from("site_settings").select).mockResolvedValue({
      data: [{ key: "chat_model", value: "gpt-4o" }],
      error: null,
    } as unknown as never);

    const settings = await getSiteSettings();
    expect(settings.chat_model).toBe("gpt-4o");
    expect(selectMock).toHaveBeenCalledTimes(2);
  });
});
