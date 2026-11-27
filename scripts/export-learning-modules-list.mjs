// Export real module list from learning_modules (slug · title · level · role_id).
// Input for BUG-08 (Phase 2 — validate AI-suggested slugs) and Phase 3 (verify L4/L5 sync).
// Filters out "[GỘP" titles. Writes JSON + prints table.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const envText = readFileSync(
  new URL("../src/frontend/.env.local", import.meta.url),
  "utf8",
);
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await supabase
  .from("learning_modules")
  .select("id, title, level, role_id, sort_order")
  .order("role_id", { ascending: true })
  .order("sort_order", { ascending: true });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

// Lọc bài "[GỘP…" (pool rác trước Phase 1 sync).
const modules = (data ?? []).filter(
  (m) => !(m.title ?? "").trim().startsWith("[GỘP"),
);

const outPath = new URL(
  "../planning/sprints/20260624-ghep-devbug-noidung/learning-modules-list.json",
  import.meta.url,
);
mkdirSync(dirname(outPath.pathname.replace(/^\//, "")), { recursive: true });
writeFileSync(outPath, JSON.stringify(modules, null, 2), "utf8");

console.log(`=== learning_modules (${modules.length} bài, đã lọc [GỘP) ===`);
console.log("slug                     | level | role            | title");
console.log("-".repeat(100));
for (const m of modules) {
  const slug = (m.id ?? "").padEnd(24);
  const lvl = String(m.level ?? "?").padEnd(5);
  const role = (m.role_id ?? "?").padEnd(15);
  console.log(`${slug} | ${lvl} | ${role} | ${m.title ?? ""}`);
}

const byRole = {};
const byLevel = {};
for (const m of modules) {
  byRole[m.role_id] = (byRole[m.role_id] ?? 0) + 1;
  byLevel[m.level] = (byLevel[m.level] ?? 0) + 1;
}
console.log("\n=== Tổng theo role ===");
for (const [r, n] of Object.entries(byRole)) console.log(`  ${r}: ${n}`);
console.log("=== Tổng theo level ===");
for (const [l, n] of Object.entries(byLevel)) console.log(`  L${l}: ${n}`);

const maxLevel = Math.max(...modules.map((m) => m.level ?? 0));
console.log(`\nMax level trong DB: ${maxLevel} (Phase 3 sẽ nới lên 5)`);
console.log(`\nĐã ghi JSON: ${outPath.pathname}`);
