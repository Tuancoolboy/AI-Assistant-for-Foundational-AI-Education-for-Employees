/**
 * Seed CHỈ vai trò "vibe-code" (khóa Học viên K2) vào Supabase.
 * Chạy: npm run seed:vibecode
 *
 * Vì sao cần: luồng lộ trình (init-suggested → user_roadmap) đọc bài từ bảng
 * learning_modules. Bài vibe-code chỉ có trong data tĩnh nên phải seed vào DB
 * thì học viên mới vào được lộ trình ở real mode.
 *
 * AN TOÀN: chỉ đụng đúng các dòng vai trò "vibe-code" + 1 skill_group của nó.
 * KHÔNG re-upsert các vai trò khác (khác với seed:modules đổ toàn bộ) → không
 * ảnh hưởng nội dung khóa HR/Kinh doanh... đang có trên DB. Upsert theo id nên
 * chạy lại nhiều lần vẫn an toàn (idempotent).
 *
 * Thứ tự bắt buộc: seed skill_groups TRƯỚC (FK learning_modules.skill_slug ->
 * skill_groups.slug), rồi mới seed learning_modules.
 */

import { LEARNING_MODULES } from "../src/frontend/lib/learning-modules-data";
import { SKILL_LABELS } from "../src/frontend/lib/roles";

const ROLE_ID = "vibe-code";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !serviceKey) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const vibeModules = LEARNING_MODULES.filter((m) => m.role_id === ROLE_ID);
if (vibeModules.length === 0) {
  console.error("Không tìm thấy bài vibe-code trong LEARNING_MODULES.");
  process.exit(1);
}

// Các nhóm kỹ năng (skill_slug) mà bài vibe-code dùng — seed vào skill_groups trước.
const slugs = [...new Set(vibeModules.map((m) => m.skill_slug ?? `${ROLE_ID}-khac`))];
const skillGroupRows = slugs.map((slug, i) => ({
  slug,
  role_id: ROLE_ID,
  label: SKILL_LABELS[slug] ?? "Vibe coding — build app bằng AI",
  sort_order: 100 + i,
  is_active: true,
}));

const moduleRows = vibeModules.map((m) => ({
  id: m.id,
  role_id: m.role_id,
  title: m.title,
  duration_min: m.duration_min,
  level: m.level,
  sort_order: m.sort_order,
  summary: m.summary,
  content: m.content,
  learnings: m.learnings,
  sections: m.sections,
  practice_prompt: m.practice_prompt,
  attached_file: m.attached_file,
  skill_slug: m.skill_slug ?? `${ROLE_ID}-khac`,
  published: true,
  updated_at: new Date().toISOString(),
}));

async function upsert(table: string, onConflict: string, rows: unknown[]) {
  const response = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
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
    console.error(`Seed ${table} failed:`, body || response.statusText);
    process.exit(1);
  }
}

async function main() {
  console.log(`Seeding ${skillGroupRows.length} skill_groups (vibe-code)...`);
  await upsert("skill_groups", "slug", skillGroupRows);
  console.log(`Seeding ${moduleRows.length} learning_modules (vibe-code)...`);
  await upsert("learning_modules", "id", moduleRows);
  console.log(`✓ Đã seed ${moduleRows.length} bài + ${skillGroupRows.length} nhóm kỹ năng cho vai trò vibe-code.`);
}

main();
