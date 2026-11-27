---
phase: 1
title: "Migration & Schema"
status: pending
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Migration & Schema

## Overview
Dựng nền dữ liệu cho mô hình opt-out: bảng `skill_groups` (root), `user_skill_groups` (khóa phạm vi),
`user_roadmap` (junction + `is_selected`), hàm `populate_roadmap_for_group()`, view `user_group_progress`,
RLS, và `lib/lms-levels.ts` (gộp L4/L5 → Master). Migrate dữ liệu từ `user_learning_selection`.

## Requirements
- Functional: schema + hàm phủ kín + view % + RLS đúng §1–§4 của `docs/system-architecture-lms-roadmap.md`.
- Non-functional: migration idempotent + có rollback; không phá dữ liệu `user_learning_selection`/`module_progress` hiện có.

## Architecture
- `skill_groups(slug PK, role_id, label, description, sort_order, is_active)`.
- `learning_modules.skill_slug` → FK `skill_groups(slug) on delete set null` (cột đã có từ `20260628073000`).
- `user_skill_groups(user_id, skill_slug, source, assigned_by, assigned_at)` UNIQUE(user_id, skill_slug).
- `user_roadmap(user_id, module_id, skill_slug, is_selected default true, source, added_at, updated_at)` UNIQUE(user_id, module_id).
- `populate_roadmap_for_group(p_user, p_slug, p_source)` — INSERT trọn bộ bài published của nhóm, `on conflict do nothing`.
- View `user_group_progress` — % theo nhóm, mẫu số = `is_selected=true`.
- `lib/lms-levels.ts` — `toLmsLevel(dbLevel) => dbLevel>=4 ? 4 : dbLevel`.

## Related Code Files
- Create: `supabase/migrations/<UTC>_skill_groups_and_user_roadmap.sql`
- Create: `scripts/seed-skill-groups.mjs` (seed từ `HR_SKILL_LABELS`/`SKILL_LABELS`)
- Create: `scripts/migrate-selection-to-roadmap.mjs` (copy `user_learning_selection` → `user_roadmap`, backfill `user_skill_groups`)
- Create: `src/frontend/lib/lms-levels.ts`
- Reference: `src/frontend/lib/roles-hr.ts` (HR_SKILL_LABELS), `src/frontend/lib/roles.ts` (SKILL_LABELS)
- Reference: `supabase/migrations/20260622000738_user_learning_selection.sql`, `0004_learning_modules.sql`

## Implementation Steps
1. Migration: `create table skill_groups` + index `(role_id, sort_order)`.
2. Migration: FK `learning_modules.skill_slug → skill_groups(slug)` (NULLable, giữ bài chưa tag).
3. Migration: `create table user_skill_groups` + `user_roadmap` + index `(user_id, is_selected)`, `(user_id, skill_slug)`.
4. Migration: `create function populate_roadmap_for_group(...)` (SQL, idempotent).
5. Migration: `create view user_group_progress` (công thức §3.4).
6. Migration: RLS §4.2 — `skill_groups` read-only authenticated; `user_skill_groups` read-own (no user write);
   `user_roadmap` read-own + UPDATE chỉ `is_selected` khi `skill_slug ∈ user_skill_groups(user)`.
7. `seed-skill-groups.mjs`: upsert mọi slug từ `HR_SKILL_LABELS` + `SKILL_LABELS` (role_id suy từ tiền tố/ánh xạ).
8. `migrate-selection-to-roadmap.mjs`: với mỗi row `user_learning_selection` → upsert `user_roadmap` (`is_selected=true`,
   `skill_slug` từ `learning_modules`); suy `user_skill_groups` từ tập `skill_slug` đã chọn (`source='onboarding'`).
9. `lib/lms-levels.ts` + unit test `toLmsLevel` (5→4, 3→3, 1→1).
10. `npm run db:validate` (nếu có) + `npm run lint && npm run test`.

## Success Criteria
- [ ] Migration apply sạch + rollback chạy được (idempotent).
- [ ] `skill_groups` seed đủ slug khớp `HR_SKILL_LABELS`/`SKILL_LABELS`.
- [ ] `populate_roadmap_for_group('user','hr-tuyen-dung','admin')` đẩy đúng **toàn bộ** bài published của nhóm, chạy lại không nhân đôi.
- [ ] `user_group_progress` trả % chỉ tính `is_selected=true`.
- [ ] RLS: user KHÔNG insert/delete được `user_roadmap`/`user_skill_groups`; chỉ UPDATE `is_selected` trong nhóm sở hữu.
- [ ] Dữ liệu `user_learning_selection` cũ migrate đủ sang `user_roadmap` (count khớp).
- [ ] `toLmsLevel`: level 5→Master(4).

## Red-team Remediations (CHỐT — bắt buộc trước go-live)

> **GATE chặn go-live:** `SELECT count(*) FROM learning_modules WHERE published AND skill_slug IS NULL` **phải = 0**. Nếu >0, migration FAIL có chủ đích.

- **[CRITICAL] Backfill skill_slug cho TẤT CẢ bài, không chỉ 84 HR.** Backfill `20260628073000` chỉ tag 84 bài `nhan-su-*`; các vai trò khác (ke-toan, kinh-doanh, marketing, van-hanh) + bài DB-only m57–m87 (slug nằm ở `MODULE_CATEGORY_OVERRIDE`, `learning-tiers.ts:35-69`) đều `skill_slug=NULL` → auto-populate bỏ sót → roadmap rỗng/cụt. **Việc cần:** migration backfill từ `MODULE_CATEGORY_OVERRIDE` + `MODULE_CATEGORY_MAP` cho mọi vai trò; bài chưa có nhóm → tạo nhóm "khac"/placeholder hoặc chặn publish.
- **[CRITICAL] RLS UPDATE policy thêm `WITH CHECK` + trigger khóa cột.** `USING` đơn lẻ KHÔNG ràng buộc row mới → user `UPDATE skill_slug/source` để thoát phạm vi. Thêm `WITH CHECK (auth.uid()=user_id AND skill_slug ∈ owned groups)` **VÀ** `BEFORE UPDATE` trigger raise nếu đổi cột ≠ `is_selected`/`updated_at` (RLS không tự diễn đạt "cột bất biến").
- **[HIGH] View `user_group_progress` chống leak chéo user.** View thường chạy quyền owner, KHÔNG kế thừa RLS → mọi user `SELECT` thấy data người khác. Đặt `ALTER VIEW ... SET (security_invoker = on)` (PG15+) **hoặc** đổi thành function lọc `where user_id = auth.uid()`. Kiểm version Postgres trước.
- **[HIGH] Migration copy data: map `source` + lọc NULL.** `user_learning_selection.source ∈ (suggested,extra)` ≠ `user_roadmap.source ∈ (onboarding,admin)` → copy thẳng **abort cả migration**. Map cứng `→'onboarding'`; `WHERE skill_slug IS NOT NULL` (vì cột NOT NULL); log row rớt. Chỉ migrate user `learning_path_confirmed_at IS NOT NULL` (user đang dở onboarding KHÔNG tự kích hoạt roadmap).
- **[HIGH] Legacy user phải được phủ kín, không chỉ subset cũ.** User cũ chỉ có subset tự nhặt → sau migrate thiếu cả cấp Master. **Việc cần:** sau khi backfill `user_skill_groups` (suy từ subset), chạy `populate_roadmap_for_group` cho mỗi nhóm → phủ đủ; bài đã `hoan-thanh` giữ nguyên, bài mới thêm `is_selected=true`.
- **[MED] `populate_roadmap_for_group` trả đúng count.** `returning 1` trong `language sql returns int` trả 1 (hàng đầu), không phải số bài. Dùng CTE: `with ins as (insert ... returning 1) select count(*)::int from ins`. Khai báo `SECURITY DEFINER` (owner ghi được `user_roadmap`) + `set search_path`.
- **[MED] Validate `role_id` đồng nhất 3 nguồn.** Seed-time assert `learning_modules.role_id = skill_groups(skill_slug).role_id` cho mọi bài; sai → fail seed (chặn onboarding nhận nhầm nhóm chéo vai trò).
- **[MED] Cấm hard-delete `skill_groups`.** FK `set null` + `user_roadmap.skill_slug NOT NULL` mâu thuẫn khi xóa nhóm. Chỉ cho `is_active=false` (soft); không `DELETE` row nhóm.

## Risk Assessment
- Sync EM ghi đè `learning_modules` → bài mới phải mang `skill_slug`, nếu NULL sẽ rớt khỏi auto-populate. Mitigation: report bài NULL skill_slug trong seed/migrate script.
- FK `set null` an toàn khi xóa nhóm; nhưng xóa nhóm khiến bài "mồ côi" → kiểm tra trước khi drop nhóm.
- RLS sai → user sửa được bài ngoài nhóm. Mitigation: test policy bằng tài khoản thật 2 user khác nhóm.

## Security Considerations
- RLS là hàng rào chính (anti-greedy ở tầng DB). Service-role chỉ dùng trong script/admin endpoint, không lộ client.
</content>
