---
phase: 3
title: "Frontend Roadmap UI"
status: pending
priority: P1
effort: "2d"
dependencies: [2]
---

# Phase 3: Frontend Roadmap UI

## Overview
Đổi `/lo-trinh` sang cây Nhóm Kỹ năng → 4 cấp → Bài với **checkbox opt-out** (optimistic, không reload).
Bỏ luồng "chọn ≤N rồi chốt". % chỉ đếm bài đã tích. Ẩn mọi control thêm nhóm (anti-greedy).

## Requirements
- Functional: tree/accordion 2 tầng, checkbox toggle tức thì + rollback, % theo nhóm + tổng, link `/lo-trinh/[moduleId]`.
- Non-functional: trang < 3s; mobile-first; không nút/search thêm nhóm trên UI user.

## Architecture
- Store client (`useReducer`) §6: `selected: Record<id,bool>`, `status`, `pending:Set`.
- `TOGGLE_OPTIMISTIC` flip ngay → PATCH nền → `CONFIRMED`/`ROLLBACK` + toast.
- % memo từ `selected`+`status` (mẫu số = đã tích) — khớp server.
- Accordion độc lập theo `skill_slug` (chỉ re-render nhóm bị đổi).
- Cấp độ qua `toLmsLevel` (4 cấp; L5 hiện dưới Master).

## Related Code Files
- Create: `src/frontend/components/roadmap-tree.tsx` (cây Nhóm→Cấp→Bài, < 200 dòng)
- Create: `src/frontend/components/roadmap-module-checkbox.tsx` (checkbox + status badge + optimistic)
- Create: `src/frontend/lib/roadmap-store.ts` (reducer + actions + selector %)
- Modify: `src/frontend/components/lo-trinh-content.tsx` (bỏ nhánh composition/chốt → render `RoadmapTree`; giữ empty/error fallback Phase-0)
- Modify: `src/frontend/components/tien-bo-content.tsx` (đọc `progress-summary` mới)
- Reference: `src/frontend/components/lo-trinh-tiers.tsx` (mẫu group theo skill_slug, paywall overlay), `lo-trinh-composition.tsx` (gỡ dần)
- Reference: `lib/lms-levels.ts`, shadcn `Accordion`/`Checkbox`

## Implementation Steps
1. `roadmap-store.ts`: state + reducer (`TOGGLE_OPTIMISTIC/CONFIRMED/ROLLBACK`) + selector `groupPercent`,`totalPercent`.
2. `roadmap-module-checkbox.tsx`: checkbox (disable khi `pending`/paywalled) + nhãn Done/Doing/Chưa học + link bài.
3. `roadmap-tree.tsx`: fetch `GET /member/roadmap` → Accordion nhóm (badge %), sub-accordion 4 cấp, list bài.
4. Toggle handler: dispatch optimistic → `PATCH /toggle` → confirmed/rollback + toast lỗi.
5. `lo-trinh-content.tsx`: thay luồng composition+chốt bằng `RoadmapTree`; giữ loading/empty/error (không blank).
6. (BỎ — quyết định không khóa) Không render overlay paywall/CTA trong cây roadmap; mọi bài truy cập được.
7. `tien-bo-content.tsx`: số lớn "tổng giờ/tiến độ" lấy từ `progress-summary`.
8. **Anti-greedy**: rà soát — KHÔNG render nút/search "thêm nhóm" ở bất kỳ đâu trong UI user.
9. `npm run lint && npm run test && npm run build`; thử iPhone SE (375px) + 1440px.

## Success Criteria
- [ ] `/lo-trinh` hiện cây Nhóm→4 cấp→Bài; mọi bài auto-populate tích sẵn.
- [ ] Bỏ tích 1 bài → % nhóm + tổng giảm tức thì, không reload; re-tích khôi phục.
- [ ] Lỗi mạng khi toggle → rollback checkbox + toast, state không lệch.
- [ ] Bài Master gồm cả level 4 và 5 (gộp đúng).
- [ ] Không có control thêm nhóm/skill ở UI user.
- [ ] Mọi bài truy cập được (không khóa); % đạt 100% khi hoàn thành hết bài đã tích.
- [ ] Responsive 375px & 1440px; trang < 3s.

## Red-team Remediations (CHỐT)

- **[HIGH] Tắt cứng luồng opt-in cũ trong CÙNG PR — không "gỡ dần".** `learning-path/route.ts` vẫn ghi `learning_path_confirmed_at` + `user_learning_selection`; `lo-trinh-content.tsx:183-199` vẫn rẽ nhánh `confirmed`. Để song song = dual-state phân kỳ. **Việc cần:** (a) old route trả `410 Gone` ngay khi migration chạy; (b) **xóa** nhánh `confirmed`/composition trong `lo-trinh-content.tsx` cùng PR; (c) gỡ `lo-trinh-composition.tsx` (grep ref trước).
- **[HIGH] Một taxonomy cấp độ duy nhất.** Tránh 2 hệ song song: `lms-levels` (4 cấp, L5→Master) vs `buildModuleTierMap` (5 tier, chia đôi L2) — gate quiz key theo tier 1–5 (`gateQuizModuleId`) sẽ lệch nhãn giữa `/lo-trinh` và `/kiem-tra`. **Việc cần:** chọn `lms-levels` làm chuẩn; re-key gate quiz sang 4 cấp **hoặc** xóa `buildModuleTierMap`. Quyết định + ghi rõ trước khi code.
- **[MED] `TOGGLE_CONFIRMED` áp `groupPercent`/`totalPercent` từ server.** Hiện reducer chỉ clear `pending`, bỏ qua percent server trả → lệch khi tab/thiết bị khác đổi state. Apply server percent (hoặc refetch node nhóm).
- **[CHỐT] Bỏ paywall/khóa checkbox trong roadmap.** Mọi bài truy cập được, checkbox không khóa; % client đếm thẳng `is_selected=true`. Gỡ nhánh `isModulePaywalled`/overlay CTA khỏi cây roadmap (bước "Paywall" ở Implementation Steps §6 → bỏ).
- **[LOW] Nhóm bỏ tích hết → render "Không có bài đang theo dõi"**, không phải "0%" (phân biệt với "chưa bắt đầu"); cho phép trạng thái "done" khi `total_selected=0`.

## Risk Assessment
- Optimistic lệch khi nhiều toggle nhanh → `pending` set + update theo giá trị gửi lên (không toggle mù).
- Bỏ `lo-trinh-composition.tsx` có thể vỡ test/route cũ → grep usage trước khi xóa, giữ tạm nếu còn ref.
- Gộp L5→Master phải khớp `toLmsLevel` ở cả server (Phase 2) lẫn client để badge không lệch.

## Security Considerations
- Checkbox chỉ đổi `is_selected` của bài đã có sẵn — không tạo bài/nhóm. Mọi quyền cuối do RLS/endpoint quyết định.
</content>
