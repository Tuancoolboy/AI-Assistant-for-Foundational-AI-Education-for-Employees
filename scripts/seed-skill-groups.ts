/**
 * Seed bảng skill_groups (root Nhóm Kỹ năng) vào Supabase.
 * Chạy: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/seed-skill-groups.ts
 *
 * Nguồn: suy distinct (skill_slug, role_id) từ LEARNING_MODULES (skills[0]) + nhãn từ
 * HR_SKILL_LABELS / SKILL_LABELS. Bắt buộc chạy TRƯỚC `seed:modules` vì FK
 * learning_modules.skill_slug -> skill_groups(slug).
 *
 * Lưu ý: skill_groups.slug là PK → 1 slug = 1 role_id. Slug dùng chéo vai trò (generic)
 * lấy role_id của module ĐẦU TIÊN gặp (đủ cho FK + onboarding role chính). Upsert idempotent.
 */

import { LEARNING_MODULES } from "../src/frontend/lib/learning-modules-data";
import { SKILL_LABELS } from "../src/frontend/lib/roles";
import { HR_SKILL_LABELS } from "../src/frontend/lib/roles-hr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !serviceKey) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function labelFor(slug: string): string {
  return HR_SKILL_LABELS[slug] || SKILL_LABELS[slug] || slug;
}

// Distinct slug → role_id (first seen). Bỏ qua module chưa phân loại (skill_slug null).
const bySlug = new Map<string, string>();
for (const m of LEARNING_MODULES) {
  if (m.skill_slug && !bySlug.has(m.skill_slug)) {
    bySlug.set(m.skill_slug, m.role_id);
  }
}

const rows = [...bySlug.entries()].map(([slug, role_id], i) => ({
  slug,
  role_id,
  label: labelFor(slug),
  sort_order: i,
  is_active: true,
}));

// Nhóm placeholder '{role}-khac' cho mỗi vai trò → hứng bài chưa phân loại (skills[0] null),
// đảm bảo FK + gate "published AND skill_slug IS NULL = 0" sau khi seed modules.
const roles = [...new Set(LEARNING_MODULES.map((m) => m.role_id))];
for (const role_id of roles) {
  const slug = `${role_id}-khac`;
  if (!bySlug.has(slug)) {
    rows.push({
      slug,
      role_id,
      label: "Khác / chưa phân loại",
      sort_order: rows.length,
      is_active: true,
    });
  }
}

async function main() {
  console.log(`Seeding ${rows.length} skill_groups...`);
  const response = await fetch(`${url}/rest/v1/skill_groups?on_conflict=slug`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("Seed failed:", body || response.statusText);
    process.exit(1);
  }
  console.log(`✓ Đã upsert ${rows.length} skill_groups.`);
}

main();
