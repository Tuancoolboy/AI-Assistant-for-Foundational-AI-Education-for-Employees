#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const TEST_PASSWORD = "HrLevelTest2026!";
const RUN_ID = process.argv[2] ?? "20260624";
const LEVELS = [1, 2, 3, 4, 5];

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  throw new Error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const found = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}

const accounts = [];
for (const level of LEVELS) {
  const email = `codex.hr.level${level}.${RUN_ID}@test.local`;
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id);
    if (error) throw error;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: `Codex HR Level ${level}`,
      phone_number: `090000000${level}`,
    },
  });
  if (error || !data.user) {
    throw error ?? new Error(`Không tạo được ${email}`);
  }

  const now = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      email,
      full_name: `Codex HR Level ${level}`,
      phone_number: `090000000${level}`,
      role_id: null,
      ai_level: null,
      assessment_result: null,
      daily_tasks: [],
      learning_activated: true,
      learning_activated_at: now,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (profileError) throw profileError;

  accounts.push({
    level,
    email,
    password: TEST_PASSWORD,
    userId: data.user.id,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
    learningActivated: true,
  });
}

console.log(JSON.stringify({ runId: RUN_ID, accounts }, null, 2));
