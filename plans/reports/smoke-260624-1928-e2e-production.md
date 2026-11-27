# E2E Smoke Test — Production (ai-tro-ly.lucasnguyen.vn)

- Date: 2026-06-24
- Env: production `https://ai-tro-ly.lucasnguyen.vn` (HTTP→HTTPS 308 OK)
- Method: browser automation (Puppeteer) + Supabase DB verification (project `dtiylxmrqltttjswqpzu`)
- Test account (created live this run): `smoke.193921@mocan-test.vn` (HR/`nhan-su`, fresh, non-activated)

## Tiền đề nội dung (Annie full Notion sync) — VERIFIED ✅
DB `learning_modules`: 84 bài HR (`nhan-su`), **0 "[GỘP"**, **0 trùng id**, level **L1→L5** (L4=6, L5=4).
6 mã free spec đều tồn tại + `published=true` (m0,m1,m3,m4,m6,m9). → đánh dấu **Annie full Notion sync = DONE**.

## Kết quả 7 mục

| # | Mục | KQ | Ghi chú |
|---|---|---|---|
| 1 | Đăng ký | ✅ PASS | `/register` (4 trường: họ tên·SĐT·email·mật khẩu) → tạo user, email auto-confirmed, redirect `/login?registered=1` |
| 2 | Onboarding 1→5 | ❌ FAIL | **Bỏ qua BƯỚC 2 (xưng hô)**: counter nhảy 1→3. Bug BUG-05 còn trên prod |
| 3 | Lộ trình (nhảy bài giữa) | ✅ PASS | `/lo-trinh` render đúng "NHÂN SỰ/HR", tier Khối, starter-kit prompt + Copy, path builder 56 bài, save OK |
| 4 | Bài có video | ⚠ INCONCLUSIVE | Hạ tầng OK (map `module-videos.ts` → iframe `/videos/*.html`, asset prod 200) nhưng **không mở được module video live** (xem gap entitlements) |
| 5 | Trợ lý AI gợi ý | ⚠ PASS w/ concern | Chat stream OK, có ngữ cảnh role HR, clarify-card 1/3, không lỗi console. **NHƯNG over-refuse câu cơ bản "AI là gì?"** ("Em không thể bình luận…") — lệch acceptance 9.2 |
| 6 | Tiến bộ hiển thị | ✅ PASS | `/tien-bo` đủ: tổng giờ, % hoàn thành, điểm TB, level 1/5, chip 1-chạm. **+1h → 0.0→1.0 giờ** (ghi & cập nhật OK) |
| 7 | Freemium khoá bài | ✅ PASS (khác spec) | Non-activated bị chặn → redirect `/nang-cap`. **Giới hạn = 3 bài** (`DEFAULT_TRIAL_MODULE_LIMIT`), KHÔNG phải 6-bài-cố-định (FEATURE-01 chưa deploy) |

## Phát hiện chính (cần xử lý)

1. **Phase 0 chưa merge lên production.** Fix BUG-05 (`setStep("address")`) + freemium 6-bài (FEATURE-01) chỉ nằm trên nhánh `feat/phase-0-thong-luong-vao-hoc` / `feat/phase-0-freemium-fallback-overlay` (commit `1c046ac`), **chưa có ở `develop`/`main`** → prod vẫn chạy logic cũ.
   - Bằng chứng code (working tree = main): `src/frontend/components/onboarding-flow.tsx:41` → `setStep("why")` (đáng lẽ `"address"`); `StepAddress` (BƯỚC 2) là dead code.
2. **Bảng `learning_entitlements` KHÔNG tồn tại trên prod** → `loadLearningAccess` fallback `trial` cho mọi user, cap 3 bài. **Không có đường mở full access nào được deploy.** Cờ `profiles.learning_activated` KHÔNG được gate đọc (gate dùng entitlements) → demo `demo.hr@gmail.com` / `demo.nhansu@gmail.com` (activated=true) vẫn bị cap 3 bài. Đây là lý do mục 4 không kiểm được video live.
3. **Trợ lý over-refuse** "AI là gì?" — scope guard quá chặt với câu nhập môn in-scope.

## Đã làm sạch
- Revert `learning_activated` của tài khoản test về `false`. Tài khoản test `smoke.193921@…` để lại (throwaway). Browser đã đóng.

## Câu hỏi mở
- Có merge Phase 0 (BUG-05 + FEATURE-01) lên `develop`→`main` để deploy không? (đang chặn onboarding step 2 + sai gate freemium)
- `learning_entitlements` thiếu migration trên prod — chủ ý hay sót? Quyết định gate: entitlements (3 bài) vs `learning_activated` vs FEATURE-01 (6 bài)?
