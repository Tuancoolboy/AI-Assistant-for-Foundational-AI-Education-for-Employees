import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface SiteSettings {
  enable_chat_eval: boolean;
  eval_model: string;
  faithfulness_alert_threshold: number;
  chat_model: string;
  synthesis_model: string;
  grader_model: string;
  path_agent_model: string;
  daily_message_limit: number;
  max_context_tokens: number;
  max_history_messages: number;
}

export type SettingKey = keyof SiteSettings;

export const SITE_SETTING_MODEL_OPTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4o-turbo",
  "o1-mini",
] as const;

const MODEL_SETTING_KEYS = [
  "eval_model",
  "chat_model",
  "synthesis_model",
  "grader_model",
  "path_agent_model",
] as const satisfies readonly SettingKey[];

type ModelSettingKey = (typeof MODEL_SETTING_KEYS)[number];

type ValidationResult = {
  patch: Partial<SiteSettings>;
  errors: string[];
};

let cachedSettings: SiteSettings | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

export function clearSettingsCache(): void {
  cachedSettings = null;
  cacheExpiry = 0;
}

function parseEnvInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getDefaultSettings(): SiteSettings {
  return {
    enable_chat_eval: process.env.ENABLE_CHAT_EVAL === "true",
    eval_model: process.env.EVAL_MODEL || "gpt-4o-mini",
    faithfulness_alert_threshold: 0.7,
    chat_model: process.env.OPENAI_MODEL || "gpt-4o",
    synthesis_model:
      process.env.OPENAI_MODEL_SYNTHESIS ||
      process.env.OPENAI_MODEL ||
      "gpt-4o",
    grader_model: "gpt-4o",
    path_agent_model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    daily_message_limit: parseEnvInteger(process.env.RATE_LIMIT_PER_DAY, 30),
    max_context_tokens: 8000,
    max_history_messages: 10,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAllowedModel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SITE_SETTING_MODEL_OPTIONS.includes(
      value as (typeof SITE_SETTING_MODEL_OPTIONS)[number],
    )
  );
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  )
    ? value
    : fallback;
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return isIntegerInRange(value, min, max) ? value : fallback;
}

function normalizeModel(value: unknown, fallback: string): string {
  return isAllowedModel(value) ? value : fallback;
}

function isNumberInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function isIntegerInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return Number.isInteger(value) && isNumberInRange(value, min, max);
}

function normalizeSettings(
  values: Partial<Record<SettingKey, unknown>>,
  defaults: SiteSettings,
): SiteSettings {
  return {
    enable_chat_eval: normalizeBoolean(
      values.enable_chat_eval,
      defaults.enable_chat_eval,
    ),
    eval_model: normalizeModel(values.eval_model, defaults.eval_model),
    faithfulness_alert_threshold: normalizeNumber(
      values.faithfulness_alert_threshold,
      defaults.faithfulness_alert_threshold,
      0,
      1,
    ),
    chat_model: normalizeModel(values.chat_model, defaults.chat_model),
    synthesis_model: normalizeModel(
      values.synthesis_model,
      defaults.synthesis_model,
    ),
    grader_model: normalizeModel(values.grader_model, defaults.grader_model),
    path_agent_model: normalizeModel(
      values.path_agent_model,
      defaults.path_agent_model,
    ),
    daily_message_limit: normalizeInteger(
      values.daily_message_limit,
      defaults.daily_message_limit,
      0,
      1000,
    ),
    max_context_tokens: normalizeInteger(
      values.max_context_tokens,
      defaults.max_context_tokens,
      1000,
      64000,
    ),
    max_history_messages: normalizeInteger(
      values.max_history_messages,
      defaults.max_history_messages,
      1,
      50,
    ),
  };
}

export function validateSiteSettingsPatch(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return {
      patch: {},
      errors: ["Payload cài đặt không hợp lệ."],
    };
  }

  const patch: Partial<SiteSettings> = {};
  const errors: string[] = [];

  if ("enable_chat_eval" in input) {
    if (typeof input.enable_chat_eval === "boolean") {
      patch.enable_chat_eval = input.enable_chat_eval;
    } else {
      errors.push("enable_chat_eval phải là boolean.");
    }
  }

  for (const key of MODEL_SETTING_KEYS) {
    if (key in input) {
      const value = input[key];
      if (isAllowedModel(value)) {
        patch[key as ModelSettingKey] = value;
      } else {
        errors.push(`${key} không nằm trong danh sách model được hỗ trợ.`);
      }
    }
  }

  if ("faithfulness_alert_threshold" in input) {
    const value = input.faithfulness_alert_threshold;
    if (isNumberInRange(value, 0, 1)) {
      patch.faithfulness_alert_threshold = value;
    } else {
      errors.push("faithfulness_alert_threshold phải nằm trong khoảng 0-1.");
    }
  }

  if ("daily_message_limit" in input) {
    const value = input.daily_message_limit;
    if (isIntegerInRange(value, 0, 1000)) {
      patch.daily_message_limit = value;
    } else {
      errors.push("daily_message_limit phải là số nguyên từ 0 đến 1000.");
    }
  }

  if ("max_context_tokens" in input) {
    const value = input.max_context_tokens;
    if (isIntegerInRange(value, 1000, 64000)) {
      patch.max_context_tokens = value;
    } else {
      errors.push("max_context_tokens phải là số nguyên từ 1000 đến 64000.");
    }
  }

  if ("max_history_messages" in input) {
    const value = input.max_history_messages;
    if (isIntegerInRange(value, 1, 50)) {
      patch.max_history_messages = value;
    } else {
      errors.push("max_history_messages phải là số nguyên từ 1 đến 50.");
    }
  }

  return { patch, errors };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const now = Date.now();
  if (cachedSettings !== null && now < cacheExpiry) {
    return cachedSettings;
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value");

    if (error) {
      // If table doesn't exist yet or DB issue, log warning and return default fallbacks
      console.warn(
        "[site-settings] Failed to fetch settings from DB, using fallback environment values:",
        error.message,
      );
      return getDefaultSettings();
    }

    const dbSettings: Partial<SiteSettings> = {};
    for (const row of data || []) {
      dbSettings[row.key as SettingKey] = row.value;
    }

    const defaults = getDefaultSettings();
    const merged = normalizeSettings(dbSettings, defaults);

    cachedSettings = merged;
    cacheExpiry = now + CACHE_TTL_MS;
    return merged;
  } catch (err: unknown) {
    console.warn(
      "[site-settings] Exception while fetching settings, using fallback environment values:",
      err,
    );
    return getDefaultSettings();
  }
}

export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<SiteSettings[K]> {
  const settings = await getSiteSettings();
  return settings[key];
}

export async function updateSiteSettings(
  settings: Partial<SiteSettings>,
  userId: string,
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }));

  const { error } = await supabase.from("site_settings").upsert(rows);

  if (error) {
    throw new Error(
      `Failed to update site settings in DB: ${error.message}`,
    );
  }

  // Clear cache immediately
  cachedSettings = null;
  cacheExpiry = 0;
}
