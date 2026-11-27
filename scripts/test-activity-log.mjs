#!/usr/bin/env node
/**
 * Test Activity log endpoints and logic
 */

import { existsSync, readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const DEMO_COOKIE = "ai_troly_demo_session=true";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function testServerUp() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
    record("Server reachable", res.ok, BASE);
    return res.ok;
  } catch {
    record("Server reachable", false, `Cannot connect to ${BASE}`);
    return false;
  }
}

async function testActivityRouteUnauthorized() {
  const res = await fetch(`${BASE}/api/manager/team/123/activity`);
  record("GET /api/manager/team/[userId]/activity without auth → 401/403", res.status === 401 || res.status === 403);
}

async function testLearningMetricsUnauthorized() {
  const res = await fetch(`${BASE}/api/platform-admin/learning-metrics`);
  record("GET /api/platform-admin/learning-metrics without auth → 401/403", res.status === 401 || res.status === 403);
}

async function main() {
  console.log(`\nTesting Activity and Metrics APIs @ ${BASE}\n`);
  const up = await testServerUp();
  if (!up) {
    console.error("Start server first");
    process.exit(1);
  }

  await testActivityRouteUnauthorized();
  await testLearningMetricsUnauthorized();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
}

main();
