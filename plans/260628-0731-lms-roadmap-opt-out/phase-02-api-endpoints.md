---
phase: 2
title: "API Endpoints"
status: pending
priority: P1
effort: "1.5d"
dependencies: [1]
---

# Phase 2: API Endpoints

## Overview
Xây API member cho mô hình opt-out: đọc cây lộ trình, toggle checkbox, chọn nhóm (auto-populate), tổng hợp tiến độ.
Theo chuẩn hiện có (`apiOk`/`apiError`, `resolveApiSession`, real-mode Supabase, RLS + double-check tầng app).

## Requirements
- Functional: 4 endpoint member (§5 tài liệu). Toggle defense-in-depth ngoài RLS.
- Non-functional: < 3s; không lộ secret; copy lỗi tiếng Việt; idempotent populate.

## Architecture
- `GET /api/member/roadmap` → cây `{ groups:[{ slug,label,percent, levels:[{ level,label,modules:[{id,title,isSelected,status}] }] }] }`.
  Join `user_roadmap` + `module_progress` + `learning_modules`, group theo `skill_slug` → `toLmsLevel`.
- `PATCH /api/member/roadmap/toggle` `{ moduleId, isSelected }` → flip `is_selected`; guard `module.skill_slug ∈ owned groups`; trả `groupPercent`,`totalPercent`.
- `GET /api/member/skill-groups` → nhóm user sở hữu (nguồn `user_skill_groups`).
- `POST /api/member/skill-groups` `{ skill_slugs }` (onboarding) → validate role khớp → upsert `user_skill_groups(source='onboarding')` → `populate_roadmap_for_group` mỗi slug.
- `GET /api/member/progress-summary` → `{ totalSelected,totalCompleted,percent,byGroup }`.

## Related Code Files
- Create: `src/frontend/app/api/member/roadmap/route.ts` (GET)
- Create: `src/frontend/app/api/member/roadmap/toggle/route.ts` (PATCH)
- Create: `src/frontend/app/api/member/skill-groups/route.ts` (GET + POST)
- Create: `src/frontend/app/api/member/progress-summary/route.ts` (GET)
- Create: `src/frontend/lib/roadmap-service.ts` (truy vấn + tính %, tái dùng giữa endpoints)
- Reference: `src/frontend/app/api/member/learning-path/route.ts` (mẫu session/validate), `app/api/progress/route.ts`
- Reference: `src/frontend/lib/learning-access.ts` (`canAccessModule`), `lib/lms-levels.ts`, `lib/api-error.ts`

## Implementation Steps
1. `roadmap-service.ts`: `getRoadmapTree(userId)`, `recomputePercent(userId, slug)`, `userOwnsGroup(userId, slug)`.
   % dùng view `user_group_progress` hoặc tính trong service (mẫu số `is_selected=true`).
2. `GET /member/roadmap`: session → tree → `apiOk`. Empty state khi chưa có nhóm (mảng rỗng, không 500).
3. `PATCH /toggle`: parse + validate (`moduleId` str, `isSelected` bool) → 404 nếu module không tồn tại →
   `userOwnsGroup` false → 403 → update `user_roadmap` → recompute → trả percent. (RLS chặn lần 2.)
4. `GET /member/skill-groups`: list từ `user_skill_groups` join `skill_groups` (label).
5. `POST /member/skill-groups`: validate `skill_slugs` ∈ `skill_groups` cùng `role_id` profile → upsert
   `user_skill_groups` → loop `populate_roadmap_for_group(...,'onboarding')` → trả `roadmapCount`.
6. `GET /member/progress-summary`: tổng `is_selected` + tổng `hoan-thanh` + theo nhóm.
7. (Tùy) batch toggle `{ changes:[{moduleId,isSelected}] }` nếu cần UX gom nhiều thao tác.
8. `npm run lint && npm run test && npm run build`.

## Success Criteria
- [ ] `GET /member/roadmap` trả cây đúng Nhóm→Cấp(4)→Bài kèm `isSelected`+`status`.
- [ ] `PATCH /toggle` bài trong nhóm → 200 + percent đúng; bài ngoài nhóm → 403; module lạ → 404.
- [ ] `POST /member/skill-groups` chọn nhóm → roadmap được phủ kín (count = số bài published của nhóm).
- [ ] Chọn lại cùng nhóm (idempotent) → không nhân đôi, không reset `is_selected` user đã chỉnh.
- [ ] `progress-summary` % khớp công thức opt-out.
- [ ] lint+test+build pass.

## Red-team Remediations (CHỐT)

- **[CHỐT] Bỏ hẳn chế độ khóa/paywall trong roadmap.** Quyết định: mọi bài auto-populate đều truy cập được → % đạt 100% tự nhiên, KHÔNG xử lý đặc biệt mẫu số. `recomputePercent` đếm thẳng `is_selected=true`. Không còn `isModulePaywalled` trong luồng roadmap; toggle chỉ kiểm `userOwnsGroup`.
- **[MED] Sort bài: `sort_order` là chính, `orderedModuleIds` chỉ tiebreak.** `orderedModuleIds` chỉ chứa subset gợi ý → bài ngoài list rơi về cuối thứ tự ngẫu nhiên (`9999`). Sort chính theo `learning_modules.sort_order`.
- **[MED] PATCH trả `groupPercent`/`totalPercent` tính lại từ DB** (không tin client) để store đồng bộ (xem Phase 3 store fix).
- **[HIGH] Onboarding POST skill-groups = service-role nhưng route user-facing.** RLS không cấp INSERT `user_skill_groups` cho user → route phải chạy service-role. Validate **chặt** `skill_slugs ∈ skill_groups WHERE role_id = profile.role_id` (chặn user tự gán nhóm trả phí/chéo vai trò). Audit-log thao tác.

## Risk Assessment
- Truy vấn cây N+1 nếu loop từng nhóm → dùng 1 query join + group ở app. Mitigation: đo thời gian với user 80 bài.
- Toggle race (double-click) → idempotent update theo giá trị `isSelected` gửi lên (không dùng NOT).
- Validate `role_id` khi chọn nhóm để chặn user gán nhóm chéo vai trò.

## Security Considerations
- Mọi endpoint qua `resolveApiSession` (Supabase mode). Double-check ownership tầng app + RLS tầng DB.
- POST skill-groups chỉ cho phép slug đúng `role_id` của chính user (onboarding self-service); admin assign ở Phase 4.
</content>
