# FE-15 — Lộ trình 4 tier + khoá tuần tự (gated progression)

> Phạm vi: CHỈ trang Lộ trình `/lo-trinh` của nhân viên (P1). KHÔNG đụng chat/agent,
> KHÔNG đụng module Topic, KHÔNG đụng dashboard quản lý.

## 1. Mục tiêu

Gom các module của mỗi vai trò thành **4 tier theo độ khó**, học **tuần tự**: phải
hoàn thành tier trước mới mở tier sau. Giống giao diện accordion theo "khối", mỗi khối
gồm nhiều bài + 1 bài kiểm tra cổng (gate quiz).

> ⚠ Trước màn 4 tier này có **bước chọn bài & chốt lộ trình** — xem §7, §8. Người dùng
> chọn từ lộ trình gợi ý + kỹ năng khác (tối đa 15 bài), chốt 1 lần, rồi mới ra màn 4 tier
> trên đúng tập bài đã chọn.

4 tier (cố định, áp dụng cho cả 5 vai trò):

| tier | Tên hiển thị |
|---|---|
| 1 | Cơ bản |
| 2 | Nâng cao |
| 3 | Nâng trình |
| 4 | Master |

## 2. Điều kiện mở tier kế tiếp (CHỐT)

- **Tier 1** luôn mở.
- **Tier N (N>1)** mở khi: (a) **tất cả** module của tier N-1 có `module_progress.status = 'hoan-thanh'`, **VÀ** (b) **đạt bài kiểm tra cổng** của tier N-1 (`quiz_results.passed = true`, tức `score ≥ 70`).
- Tier bị khoá: hiển thị 🔒 + dòng "Hoàn thành khối trước để mở", KHÔNG mở được bài bên trong.

> Lưu ý GĐ1 (mục 12 CLAUDE.md — giữ ma sát thấp): không khoá NGANG trong cùng tier
> (các bài trong 1 tier vẫn học tự do theo thứ tự gợi ý). Chỉ khoá GIỮA các tier.

## 3. Data model

**Không cần migration mới.** Dùng dữ liệu tĩnh + bảng sẵn có.

### 3.1 `src/frontend/lib/roles.ts`
- Thêm field `tier: 1 | 2 | 3 | 4` vào type `RoleModule`. Gán tier cho TỪNG module hiện có,
  suy từ `level` đang có (level 1→tier 1, level 2→tier 2-3 chia hợp lý, level 3→tier 4) —
  **Claude Code đề xuất phân bổ, để Lucas duyệt**, không tự ý xáo trộn nội dung bài.
- Thêm export `LEARNING_TIERS = [{ id:1, label:'Cơ bản' }, … {4,'Master'}]`.
- Thêm `gateQuiz` cho mỗi tier của mỗi vai trò: cấu trúc giống `QuizQuestion[]` đang có.
  Nguồn: tách/trích từ `role.quiz[]` hiện tại theo tier, hoặc tạo 3–5 câu mỗi tier.
  Nếu chưa đủ nội dung → tạo stub TODO rõ ràng, KHÔNG bịa kiến thức sai.

### 3.2 Bảng dùng lại (không sửa schema)
- `module_progress(status)` — đã có, suy "tier trước đã xong".
- `quiz_results(module_id, role_id, score, passed)` — ghi điểm gate quiz với
  quy ước `module_id = '{roleId}-tier{n}-quiz'` (vd `kinh-doanh-tier1-quiz`).
  Tái dùng API `/api/quiz-results` sẵn có; nếu cần, mở rộng để nhận `module_id` dạng này.

## 4. UI (`src/frontend/components/lo-trinh-content.tsx` + trang `/lo-trinh`)

- Gom module theo `tier`, render 4 khối accordion (mở/đóng), thứ tự 1→4.
- Mỗi khối: tiêu đề tier + % hoàn thành riêng của khối + danh sách bài + **bài kiểm tra cổng** ở cuối.
- Khối đã mở: bài bấm vào học bình thường (giữ luồng `/lo-trinh/[moduleId]` hiện có).
- Khối khoá: phủ mờ + 🔒 + "Hoàn thành khối trước để mở".
- Nút vào gate quiz dẫn tới `/kiem-tra/[roleId]` (có thể truyền tier qua query `?tier=n`).
- Giữ nguyên khối **starter kit** (prompt/tool) và phần extra lessons.
- % hoàn thành tổng vẫn hiển thị như cũ.

## 5. Acceptance

- [ ] Vai trò bất kỳ: module gom đúng 4 tier, hiển thị accordion theo thứ tự.
- [ ] Tier 1 mở sẵn; tier 2-4 khoá ban đầu (🔒).
- [ ] Hoàn thành hết bài tier 1 **nhưng chưa đạt gate quiz** → tier 2 VẪN khoá.
- [ ] Hoàn thành hết bài tier 1 **+ đạt gate quiz ≥70%** → tier 2 mở.
- [ ] Bài trong tier khoá không mở được (chặn cả route trực tiếp `/lo-trinh/[moduleId]`).
- [ ] Không phá %, starter kit, extra lessons.
- [ ] `npm run lint && npm run test && npm run build` xanh.

## 7. Luồng chọn bài & chốt lộ trình (composition) — BƯỚC TRƯỚC §4

Lần đầu vào `/lo-trinh`:

**Tiền điều kiện:** chưa làm bài đánh giá (`aiLevel` chưa có) → **redirect sang bài đánh giá**.
Có đánh giá → vào màn chọn.

**Màn chọn gồm 2 phần:**
- **A. Lộ trình gợi ý dành cho bạn** — badge **"Level {levelLabel}"** (từ assessment). Liệt kê
  các module gợi ý (lấy ID từ `generated_learning_paths.result` — Claude Code KIỂM TRA shape
  thật của jsonb trước khi parse). Mỗi module có checkbox, **mặc định tích sẵn**.
- **B. Kỹ năng khác** — các module của vai trò **không** nằm trong danh sách gợi ý. Checkbox,
  mặc định bỏ tích.

**Note trên cùng:** "Chọn tối đa 15 bài để học tốt nhất."

**Cap 15 — CHẶN CỨNG:** khi đã tích đủ 15, các checkbox chưa tích bị **disable** + hiện
"Đã đủ 15 bài". Bỏ tích 1 bài thì mở lại.

**Nút "Xác nhận lộ trình":** lưu tập module đã chọn + đánh dấu **đã chốt**.

**Chốt 1 lần (CHỐT):** sau khi xác nhận, KHÔNG cho người dùng đổi — vào thẳng màn 4 tier (§4),
ẩn màn chọn. Muốn đổi phải qua admin (xoá cờ chốt bằng service role; KHÔNG làm UI cho user ở GĐ1).

**Sinh lộ trình:** các module đã chọn được phân vào 4 tier theo field `tier` (§3.1). Màn 4 tier (§4)
chỉ hiển thị + khoá tuần tự trên **tập module đã chọn**, không phải toàn bộ module của vai trò.

## 8. Data cho composition — migration mới

Tạo `supabase/migrations/<timestamp>_user_learning_selection.sql` (idempotent + RLS + rollback):

```sql
create table if not exists public.user_learning_selection (
  user_id    uuid not null references auth.users on delete cascade,
  module_id  text not null,
  source     text not null check (source in ('suggested','extra')),
  created_at timestamptz not null default now(),
  primary key (user_id, module_id)
);
alter table public.user_learning_selection enable row level security;
create policy uls_select_own on public.user_learning_selection
  for select using (auth.uid() = user_id);
create policy uls_insert_own on public.user_learning_selection
  for insert with check (auth.uid() = user_id);
create policy uls_delete_own on public.user_learning_selection
  for delete using (auth.uid() = user_id);

-- Cờ chốt lộ trình (null = chưa chốt). Set bằng API server-side.
alter table public.profiles
  add column if not exists learning_path_confirmed_at timestamptz;
```

**API** (`src/frontend/app/api/member/learning-path/`):
- `GET` — trả: danh sách module gợi ý (từ `generated_learning_paths`), catalog "kỹ năng khác",
  level badge, và trạng thái đã chốt.
- `POST` — body `{ module_ids[] }`. Validate **≤ 15**; chặn nếu **đã chốt**; ghi `user_learning_selection`
  + set `profiles.learning_path_confirmed_at = now()`.

## 9. Acceptance (bổ sung cho composition)

- [ ] Chưa làm đánh giá → vào `/lo-trinh` bị đẩy sang bài đánh giá.
- [ ] Có đánh giá → thấy "Lộ trình gợi ý dành cho bạn" + badge Level đúng, module gợi ý tích sẵn.
- [ ] Phần "Kỹ năng khác" liệt kê module ngoài gợi ý, tích thêm được.
- [ ] Tích đủ 15 → checkbox còn lại bị khoá; bỏ tích thì mở lại.
- [ ] Bấm "Xác nhận" → lưu lựa chọn + chốt; vào lại `/lo-trinh` ra thẳng màn 4 tier trên đúng bài đã chọn.
- [ ] Đã chốt thì user KHÔNG đổi được lựa chọn nữa.

## 10. KHÔNG đụng
- `app/api/chat/**`, gating Case A/B/C, module Topic, `bang-xep-hang`, dashboard quản lý.
- Màn 4 tier (§4) ưu tiên dùng `quiz_results` sẵn có; chỉ thêm migration cho composition (§8).
