import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const root = process.cwd();
const outPath = path.join(root, "skill-gaps-export.json");

const { data, error } = await supabase
  .from("skill_gaps")
  .select("*")
  .eq("status", "new")
  .order("occurrence_count", { ascending: false });

if (error) {
  console.error("Supabase query failed:", error.message);
  process.exit(1);
}

const gaps = data ?? [];

const payload = {
  exportedAt: new Date().toISOString(),
  count: gaps.length,
  skill_gaps: gaps,
};

fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Exported ${gaps.length} skill gaps (status=new) to ${path.relative(root, outPath)}`);

if (gaps.length > 0) {
  const top5 = gaps.slice(0, 5);
  console.log("\nTop 5 by occurrence_count:");
  for (const gap of top5) {
    console.log(
      `  [${gap.occurrence_count}x, ${gap.distinct_user_count} users] ${gap.sample_question}`,
    );
  }
}
