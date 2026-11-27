---
phase: 4
title: "Admin & Test"
status: pending
priority: P2
effort: "1d"
dependencies: [2, 3]
---

# Phase 4: Admin & Test

## Overview
Endpoint admin gán/gỡ Nhóm Kỹ năng cho user (auto-populate qua service-role) + resync bài mới, và bộ test
(unit + e2e luồng vàng) chốt toàn bộ tính năng opt-out.

## Requirements
- Functional: admin assign/remove nhóm → roadmap user cập nhật; resync đẩy bài mới của nhóm.
- Non-functional: admin-only (service-role / role guard); không lộ key; e2e xanh.

## Architecture
- `POST /api/admin/users/[id]/skill-groups` `{ skill_slugs }` → upsert `user_skill_groups(source='admin', assigned_by)` → `populate_roadmap_for_group(...,'admin')`.
- `DELETE /api/admin/users/[id]/skill-groups/[slug]` → xóa nhóm + (tùy) xóa/giữ row roadmap nhóm đó.
- `POST /api/admin/skill-groups/[slug]/resync` → với mọi user có nhóm → `populate_roadmap_for_group` (chỉ thêm bài thiếu).
- Guard admin: tái dùng cơ chế quyền hiện có (`platform-admin`/manager) — kiểm trước khi thao tác.

## Related Code Files
- Create: `src/frontend/app/api/admin/users/[id]/skill-groups/route.ts` (POST)
- Create: `src/frontend/app/api/admin/users/[id]/skill-groups/[slug]/route.ts` (DELETE)
- Create: `src/frontend/app/api/admin/skill-groups/[slug]/resync/route.ts` (POST)
- Create: `src/frontend/lib/__tests__/lms-levels.test.ts`, `roadmap-service.test.ts`
- Create/Modify: e2e Playwright `tests/e2e/roadmap-opt-out.spec.ts`
- Reference: `app/api/platform-admin/*`, `app/api/manager/*` (mẫu admin guard)

## Implementation Steps
1. Admin guard helper (kiểm role admin/manager) dùng chung 3 endpoint.
2. `POST admin/.../skill-groups`: validate slug + user → upsert `user_skill_groups` + populate. Trả `roadmapCount`.
3. `DELETE admin/.../skill-groups/[slug]`: xóa nhóm; quyết định xóa row roadmap thuộc nhóm (default: xóa để % không tính nhóm đã gỡ).
4. `POST admin/skill-groups/[slug]/resync`: loop user có nhóm → populate (chỉ bài thiếu) → trả `usersUpdated, modulesAdded`.
5. Unit test: `toLmsLevel`, `recomputePercent` (mẫu số is_selected), `userOwnsGroup`.
6. E2e luồng vàng: onboarding chọn nhóm → `/lo-trinh` đủ bài tích sẵn → bỏ tích 1 bài → % giảm đúng → đánh dấu hoàn thành bài → % tăng đúng.
7. E2e bảo mật: user A không toggle được bài thuộc nhóm chỉ user B có (403).
8. `npm run lint && npm run test && npm run build` + chạy e2e.

## Success Criteria
- [ ] Admin gán nhóm → roadmap user phủ kín bài nhóm đó (count đúng).
- [ ] Admin gỡ nhóm → bài nhóm đó rời khỏi % của user.
- [ ] `resync` đẩy bài mới của nhóm vào user cũ, không nhân đôi.
- [ ] Endpoint admin chặn user thường (403/401).
- [ ] Unit test % opt-out + `toLmsLevel` xanh.
- [ ] E2e luồng vàng + e2e cross-user-403 xanh.
- [ ] lint+test+build pass.

## Red-team Remediations (CHỐT)

- **[CRITICAL] Admin guard có thật + assertAdmin dòng 1 mọi route.** Service-role **bypass RLS hoàn toàn** → app-guard là rào DUY NHẤT. Plan không được "giả định guard tồn tại": Phase-04 step 1 phải **trỏ đúng module/function guard hiện có** (grep `platform-admin`/`manager` trong `app/api/platform-admin/*`, `lib/`), nếu chưa có thì tạo `assertAdmin(session)`. Gọi đầu tiên ở **cả 3** route.
- **[CRITICAL] E2e 403 cho CẢ 3 admin route** (không chỉ toggle): JWT thường gọi POST assign / DELETE / resync → 403/401.
- **[HIGH] Resync thêm bài mới với `is_selected=false` (opt-in retro).** Mặc định `true` làm user 100% tụt xuống 91% không báo. Bài thêm về sau → `is_selected=false` + badge "N bài mới" để user tự tích. Không di chuyển mẫu số ngầm.
- **[HIGH] Soft-delete membership, KHÔNG hard-delete `user_roadmap`.** DELETE nhóm rồi re-assign + `on conflict do nothing` sẽ **hồi sinh** các bài user đã bỏ tích. Đổi DELETE → set `user_skill_groups` inactive; giữ row `user_roadmap` (lịch sử is_selected sống sót). Resync không bao giờ ghi đè `is_selected` user đã chỉnh.
- **[MED] Reconcile `user_roadmap.skill_slug` drift.** Khi bài đổi nhóm, denormalized slug lệch `learning_modules.skill_slug` → resync sửa luôn slug drifted.

## Risk Assessment
- DELETE nhóm: xóa row roadmap mất lịch sử is_selected user đã chỉnh → cân nhắc soft-remove. Mặc định cứng, ghi rõ trong PR.
- Resync hàng loạt nhiều user → batch/limit để tránh timeout; log số user xử lý.
- Admin guard sai → leo thang quyền. Test bằng tài khoản non-admin.

## Security Considerations
- Admin endpoint dùng service-role server-side; kiểm quyền trước mọi mutation; ghi `assigned_by` để audit.
- Không commit key; resync ghi `audit-log` (ai chạy, ảnh hưởng bao nhiêu user).
</content>
