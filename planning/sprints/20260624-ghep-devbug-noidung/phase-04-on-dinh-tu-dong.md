---
phase: 4
title: "Ổn định & tự động (published flag, schedule sync, smoke test)"
status: pending
priority: P2
effort: "1-2d"
dependencies: [3]
---

# Phase 4: Ổn định & tự động (EM + DEV)

## Overview
Bỏ "lọc theo tên" mong manh bằng cột `published`/`status`; tự động hoá sync; smoke test toàn flow.

## Requirements
- Thay lọc theo tên ("[GỘP…") bằng cột `published`/`status` ở Notion + `learning_modules`.
  Bộ sinh path chỉ lấy `published=true`, biết optional/L4/L5.
- Thêm Schedule cho sync (hoặc giữ manual + "Run now" sau khi sửa Notion) — **EM**.
- Smoke test toàn flow.

## Related Code Files
- Create: `supabase/migrations/<UTC>_add_learning_modules_published_flag.sql`
  (thêm cột `published boolean default true` hoặc `status text`; idempotent + rollback)
- Modify: `src/frontend/lib/learning-modules-data.ts` + `lib/learning-path-selection.ts`
  (lọc `published=true` thay vì lọc tên)
- Modify: `src/frontend/lib/learning-tiers.ts` (nhận biết optional/L4/L5 theo cột mới)
- EM (ngoài repo): node sync map Notion `published`/`status` → cột mới; cấu hình Schedule.

## Implementation Steps
1. Migration thêm cột `published`/`status` (default an toàn cho bài hiện có).
2. Sửa truy vấn pool/bộ sinh: chỉ lấy `published=true`; gỡ logic lọc theo tên "[GỘP".
3. EM map cột + Schedule sync.
4. **Smoke test toàn flow** (e2e thủ công + Playwright nếu có):
   đăng ký → onboarding 1→5 → lộ trình (nhảy bài giữa OK) → bài có video →
   AI gợi ý đúng (link thật) → tiến bộ hiển thị → freemium khoá bài 7+ khi chưa kích hoạt.
5. `npm run lint && npm run test && npm run build`.

## Success Criteria
- [x] Pool lọc bằng `published` (cột tồn tại; 6 mã free `published=true`).
- [x] Annie full Notion sync DONE — 84 bài HR L1→L5, 0 [GỘP, 0 trùng (verified DB 2026-06-24).
- [ ] Smoke test toàn flow pass — **chạy 2026-06-24, 4/7 pass**. Xem
      `plans/reports/smoke-260624-1928-e2e-production.md`.
      FAIL: onboarding bỏ BƯỚC 2 (BUG-05 chưa merge). Concern: trợ lý over-refuse "AI là gì?";
      gate freemium = 3 bài (entitlements) chứ không phải 6 (FEATURE-01 chưa deploy);
      `learning_entitlements` thiếu trên prod → không có đường mở full access.

## Risk Assessment
- Thêm cột + đổi truy vấn pool → kiểm bài cũ không bị ẩn nhầm (default `published=true`).
- Schedule sync ghi đè định kỳ → đảm bảo Notion là nguồn chuẩn, không sửa 2 nơi.
