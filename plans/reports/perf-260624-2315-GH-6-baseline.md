# Báo cáo Perf — Audit tốc độ + Mobile (nhánh feat/audit-toc-do-web-mobile-ui)

Ngày: 2026-06-24 23:15 · Next.js 16.2.7 · build non-TTY (không in bảng size per-route → đo bằng `.next/static`).

## Baseline (TRƯỚC tối ưu)

| Chỉ số | Giá trị |
|---|---|
| Tổng `.next/static` | 2.6 MB |
| Tổng JS chunks | **2,385,666 B (~2.33 MB)** |
| Chunk lớn nhất | 393.7 KB (`0f70ududl_0pr.js` — nghi recharts) |
| Top chunks | 393.7 / 236.8 / 222.2 / 169.0 / 134.8 / 115.0 KB |

Build baseline: `Compiled successfully in 3.9s`, exit 0, 0 lỗi TS.

## Ghi chú phát hiện trong lúc audit
- **P4 (index DB) KHÔNG cần**: cả 2 index audit đề xuất đã tồn tại —
  `module_progress` có `unique (user_id, module_id)` (0001_init.sql:29, Postgres tự tạo index);
  `extra_skill_lessons` có `extra_skill_lessons_user_enrolled_idx (user_id, enrolled_at desc)` (migration 20260619190000:19). → Bỏ P4, tránh index trùng.

## Kết quả (SAU tối ưu)

| Chỉ số | Trước | Sau | Ghi chú |
|---|---|---|---|
| Tổng JS chunks | 2,385,666 B | 2,385,687 B | ~không đổi (trong sai số) |
| `.map` files | 0 | 0 | Next vốn không emit client sourcemap ở prod |
| Build | OK 3.9s | OK 3.2s | exit 0, 0 lỗi TS |

### Đánh giá trung thực
- `compress:true` và `productionBrowserSourceMaps:false` **vốn đã là default của Next 16** → no-op (chỉ ghi rõ ý định, vô hại). KHÔNG có chuyện "giảm 10-15% bundle" như audit ước tính.
- `images` config (webp/cache) chỉ có tác dụng khi dùng `next/image` — hiện chưa dùng (xem dưới).
- **Giá trị thật P0 = thêm `@next/bundle-analyzer`** (đo lường tương lai), không phải giảm size.

### Các đề xuất audit đã BÁC sau khi xác minh (tránh churn/regression)
- **DB index** (P4): bỏ — cả 2 index đã tồn tại (`module_progress` unique(user_id,module_id); `extra_skill_lessons_user_enrolled_idx`).
- **AuthLinkErrorGuard off landing**: bỏ — guard xử lý lỗi magic-link Supabase trả về `#error` trên `/`; gỡ sẽ regress.
- **Code-split recharts**: bỏ — Next App Router đã tự route-split; chỉ `manager-dashboard.tsx` import, chunk recharts (393.7KB) **không** vào shared bundle; non-manager không tải.
- **`<img>`→`next/image`** (5 chỗ): bỏ — đều load URL remote tùy ý (logo tổ chức, icon tool) hoặc `blob:` object-URL (preview ảnh nộp); `next/image` không xử lý blob: và không whitelist được domain tùy ý. Dev đã chủ ý `eslint-disable no-img-element`.

### Thay đổi thật đã ship
1. `viewport` meta (fix mobile zoom/overflow toàn cục) — REAL.
2. `@next/bundle-analyzer` + script `analyze` — tooling đo.
3. Landing mobile polish: hero `text-3xl`@mobile, CTA `h-11` touch, lo-trinh prompt grid 1→2→3 cột. Verified @375px qua Preview (không tràn ngang).
4. `perf(lesson)`: parallel hóa `getEmployeeExtraLessons` (bỏ 1 round-trip khi mở bài học).

### ⚠ Phát hiện ngoài lề (PRE-EXISTING trên develop, KHÔNG do nhánh này)
- 3 unit test FAIL ở `src/frontend/lib/assessment-hr-signals.test.ts` (mong 16 câu HR, code trả 12) — do commit `91c4c07` (feat onboarding HR survey) đổi data nhưng chưa update test. Cần chủ assessment quyết 16 hay 12.
- `scripts/vercel-cli-json.test.mjs` lỗi collection.
- Nhánh này không đụng các file đó (`git diff --name-only develop...HEAD` không có assessment/vercel) → không phải regression mới.

