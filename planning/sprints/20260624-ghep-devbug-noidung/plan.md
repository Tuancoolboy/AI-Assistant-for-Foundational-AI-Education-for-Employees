---
title: "Ghép Dev Bug Fix (web) × Nội dung/Dữ liệu (Notion→Supabase)"
date: 2026-06-24
status: dev-complete
scope: phase-1 (GĐ1)
owners: [dev, em-noidung]
blockedBy: []
blocks: []
---

# Plan — Ghép Dev Bug Fix × Nội dung/Dữ liệu

> Nguồn: `cau-lenh/KE-HOACH-GHEP_DevBug-x-NoiDung.md`.
> Mục tiêu: sửa từng bước cho hệ thống vận hành ổn định; dev & nội dung không giẫm chân.
> Thực thi **bắt đầu từ Phase 0** (blocker thông luồng vào học).

## Nguyên tắc thứ tự (giữ nguyên từ kế hoạch gốc)
1. Thông luồng vào học trước (Phase 0) — user vào được mới có nghĩa.
2. Làm sạch tầng dữ liệu (Phase 1 — EM, không đụng UI).
3. Vá UI trên dữ liệu sạch (Phase 2 — DEV).
4. Nâng cấp cấu trúc L4/L5 + mở khoá (Phase 3 — DEV+EM **release đồng thời**).
5. Ổn định & tự động hoá (Phase 4).

## Quyết định đã chốt với user (sticky — không tự đảo)
- **FEATURE-01**: KHÔNG bỏ trắng gate. Chuyển từ *chặn vào cửa* (`/cho-kich-hoat`) sang
  *giới hạn nội dung*: vào thẳng `/lo-trinh`; **6 bài đầu học thử free**; bài 7+ khoá +
  CTA nâng cấp; `learning_activated=true` (mua gói) → mở hết. Tái dùng cờ `learning_activated`.
- **BUG-05**: bước 2 onboarding (xưng hô) bị skip do điều kiện sai → bỏ skip, chạy liên tục 1→2→3→4→5.
- **BUG-01**: seed account demo thật Mộc An (HR, ~60 NV nội thất) + Memory + learning path; hint login khớp.

## Phát hiện từ scout (sửa giả định kế hoạch gốc)
- **Khoá tuần tự ĐÃ tắt sẵn**: `learning-tiers.ts:223 unlocked=true`, `isModuleLocked()` luôn `false`.
  → Phase 3 mục "bỏ khoá tuần tự" thu hẹp còn polish badge prerequisite mềm.
- **`clampLevel1to5()` đã cho phép level 5** (`assessment.ts:131`). → L5 chỉ còn: `Tier` type +
  nhãn tier + `buildModuleTierMap` + render + migration nới `level` check `1..4`→`1..5`.
- **BUG-07 là gate 1 dòng**: `roles.ts:1289 ENABLED_ONBOARDING_ROLE_IDS = ["nhan-su"]`.

## Các phase
| Phase | Tên | Owner | Trạng thái | File |
|---|---|---|---|---|
| 0 | Thông luồng vào học + freemium 6 bài + demo Mộc An | DEV | dev-done (branch feat/phase-0-thong-luong-vao-hoc) | [phase-00](phase-00-thong-luong-vao-hoc.md) |
| 1 | Làm sạch & đồng bộ dữ liệu + xuất module list | EM (+dev export query) | done — Annie full Notion sync DONE (84 bài HR L1→L5, 0 [GỘP, 0 trùng) | [phase-01](phase-01-sync-du-lieu-coordination.md) |
| 2 | Vá UI trên dữ liệu sạch (BUG-08, BUG-07, video, ChatGPT→Claude) | DEV | dev-done (branch feat/phase-2-va-ui-du-lieu-sach) | [phase-02](phase-02-va-ui-du-lieu-sach.md) |
| 3 | L5 + mở khoá (release đồng thời) | DEV+EM | done — L5 sync DONE (L4=6, L5=4 trong DB) | [phase-03](phase-03-level-5-mo-khoa.md) |
| 4 | Ổn định & tự động (published flag, schedule, smoke test) | EM+DEV | dev-done; sync DONE; smoke test đang chạy production 2026-06-24 | [phase-04](phase-04-on-dinh-tu-dong.md) |

## Phụ thuộc cần nhớ (để không vỡ)
- Đừng đẩy L5 lên DB trước khi UI hỗ trợ (Phase 3 đồng thời — hai bên bấm nút cùng đợt).
- Ẩn bài "[GỘP…" ở Phase 1 trước khi fix BUG-08 (AI không gợi ý bài rác).
- BUG-02 blank có thể do generation null → fix fallback (dev) + pool sạch (em) song song.
- Notion là nguồn chuẩn duy nhất (one-way); mỗi lần sync ghi đè `learning_modules`.

## Quy trình bắt buộc (mỗi phase = 1 branch)
- `git checkout develop && git pull` → nhánh `{type}/{noi-dung}` (`.agents/rules/agent-workflow.md`).
- Trước báo xong: `npm run lint && npm run test && npm run build` pass; cập nhật
  `WORKLOG.md` + `specs/PROJECT-CONTINUATION.md`; mở MR vào `develop`.
- Migration: 14-digit UTC timestamp, idempotent + rollback, `npm run db:validate`.

## Validation Summary
**Validated:** 2026-06-24 · **Questions asked:** 4

### Confirmed Decisions
- **6 bài free = danh sách CỐ ĐỊNH** (không theo path sinh per-user): `m0, m1, m3, m4, m9, m6`
  — chung cho MỌI vai trò. Điều kiện: 6 mã này phải có sẵn trong Supabase (Phase 1 sync).
  Sau bài thứ 6 → hiện tường chắn dùng thử.
- **Freemium**: chỉ khoá mềm + CTA liên hệ; `learning_activated` set thủ công (admin).
  KHÔNG tích hợp payment (giữ đúng scope GĐ1).
- **Demo account**: `demo@mocan.vn` / `mocan2026` — seed **auth user thật** qua service-role
  (script server-side), profile HR + memory Mộc An + learning path.
- **BUG-08**: **inject list module thật + validate slug** AI trả về trước khi render link.

### Action Items
- [ ] Phase 0: đổi logic free-quota từ "6 đầu theo thứ tự" → **danh sách cố định** `[m0,m1,m3,m4,m9,m6]`
      (cấu hình hằng số, dùng chung mọi role). Verify 6 mã tồn tại sau Phase 1.
- [ ] Phase 2: BUG-08 thêm bước **validate slug** sau khi inject list.
- [ ] Xác minh tiền tố mã module thực tế (`{role}-m{n}` hay global) cho 6 mã free khi seed/sync.

## Câu hỏi mở
- 6 mã free dùng tiền tố nào? (`nhan-su-m0`… hay mã global) — chốt khi seed Phase 0 / sync Phase 1.
