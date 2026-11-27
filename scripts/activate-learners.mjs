// One-off: activate learning access for specific accounts by email.
// Usage: node scripts/activate-learners.mjs           (dry-run, shows current state)
//        node scripts/activate-learners.mjs --apply    (sets learning_activated = true)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// load env from src/frontend/.env.local
const envText = readFileSync(new URL("../src/frontend/.env.local", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const EMAILS = [
  "lucasnguyen.kenli@gmail.com",
  "thaodt2.kenli@gmail.com",
  "ngocnth.nhecafe@gmail.com",
  "nguyenlien2624@gmail.com",
];

const apply = process.argv.includes("--apply");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: rows, error } = await supabase
  .from("profiles")
  .select("id, email, full_name, learning_activated, learning_activated_at")
  .in("email", EMAILS);

if (error) {
  console.error("Query error:", error.message);
  process.exit(1);
}

const byEmail = new Map((rows ?? []).map((r) => [r.email, r]));
console.log(`\n=== Current state (${apply ? "APPLY" : "DRY-RUN"}) ===`);
for (const email of EMAILS) {
  const r = byEmail.get(email);
  if (!r) console.log(`  [MISSING] ${email} — không tìm thấy profile`);
  else console.log(`  [${r.learning_activated ? "ACTIVE" : "PENDING"}] ${email} (${r.full_name ?? "—"})`);
}

if (!apply) {
  console.log("\nDry-run. Thêm --apply để kích hoạt.");
  process.exit(0);
}

const toActivate = EMAILS.map((e) => byEmail.get(e)).filter((r) => r && !r.learning_activated);
if (toActivate.length === 0) {
  console.log("\nKhông có tài khoản nào cần kích hoạt.");
  process.exit(0);
}

const now = new Date().toISOString();
let ok = 0;
for (const r of toActivate) {
  const { error: upErr } = await supabase
    .from("profiles")
    .update({ learning_activated: true, learning_activated_at: now, updated_at: now })
    .eq("id", r.id);
  if (upErr) console.log(`  [FAIL] ${r.email}: ${upErr.message}`);
  else {
    ok++;
    console.log(`  [ACTIVATED] ${r.email}`);
  }
}
console.log(`\nĐã kích hoạt ${ok}/${toActivate.length} tài khoản.`);
