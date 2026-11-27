# FE-16 — Lưu Skill vào "Bộ kỹ năng cá nhân"

> Phạm vi: tính năng cho nhân viên (P1). KHÔNG đụng chat/agent, Topic, dashboard quản lý.

## 1. Mục tiêu

Học xong một bài/module, người dùng **tự bấm "Lưu skill"** để thêm kỹ năng vào
**bộ kỹ năng cá nhân** của mình, và xem lại ở một trang riêng. Cơ chế thủ công
(không tự động) — người học chủ động chọn skill muốn giữ.

## 2. Data model — migration mới

Tạo `supabase/migrations/<timestamp>_user_saved_skills.sql` (theo
`.agents/rules/supabase-migrations.md`). Idempotent + RLS + rollback ở cuối.

```sql
create table if not exists public.user_saved_skills (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  skill_id        uuid not null references public.skills on delete cascade,
  source_module_id text,                       -- bài nào lưu (truy vết)
  saved_at        timestamptz not null default now(),
  unique (user_id, skill_id)                   -- mỗi skill chỉ lưu 1 lần
);
create index if not exists user_saved_skills_user_idx
  on public.user_saved_skills (user_id);

alter table public.user_saved_skills enable row level security;

-- Chỉ chủ sở hữu đọc/ghi/xoá skill của mình.
create policy user_saved_skills_select_own on public.user_saved_skills
  for select using (auth.uid() = user_id);
create policy user_saved_skills_insert_own on public.user_saved_skills
  for insert with check (auth.uid() = user_id);
create policy user_saved_skills_delete_own on public.user_saved_skills
  for delete using (auth.uid() = user_id);
```

Dùng lại bảng `skills` + `module_skills` (module → skill) đã có để biết một module
gắn với skill nào.

## 3. API (`src/frontend/app/api/member/skills/`)

- `POST /api/member/skills` — body `{ module_id }`. Server: tra `module_skills` lấy
  skill(s) của module → insert vào `user_saved_skills` cho `auth.uid()` (upsert, bỏ qua trùng).
  Trả danh sách skill vừa lưu.
- `GET /api/member/skills` — trả các skill đã lưu của user (join `skills` lấy name/description).
- `DELETE /api/member/skills/[skillId]` — gỡ 1 skill khỏi bộ cá nhân.

RLS đã chặn ở DB; API chỉ thao tác trên `auth.uid()`.

## 4. UI

### 4.1 Nút "Lưu skill"
- Hiện ở trang chi tiết bài `/lo-trinh/[moduleId]` khi `module_progress.status = 'hoan-thanh'`
  (hoặc ngay cạnh nút "Đánh dấu hoàn thành" sau khi hoàn thành).
- Bấm → gọi POST → toast "Đã lưu vào bộ kỹ năng". Nếu đã lưu rồi → trạng thái "Đã lưu ✓".

### 4.2 Trang "Bộ kỹ năng cá nhân"
- Route mới `src/frontend/app/(app)/bo-ky-nang/page.tsx` + link ở nav (cạnh "Tiến bộ").
- Liệt kê skill đã lưu: tên, mô tả, bài nguồn, ngày lưu; nút gỡ.
- Empty state: "Chưa lưu kỹ năng nào — học xong một bài và bấm Lưu skill."

## 5. Acceptance

- [ ] Học xong 1 module → thấy nút "Lưu skill" → bấm → skill vào bộ cá nhân.
- [ ] Vào `/bo-ky-nang` thấy đúng skill đã lưu (tên + mô tả + bài nguồn).
- [ ] Lưu trùng không tạo bản ghi đôi (unique).
- [ ] Gỡ skill hoạt động; user chỉ thấy skill của chính mình (RLS).
- [ ] Module chưa hoàn thành thì KHÔNG có nút lưu (hoặc disabled).
- [ ] `npm run lint && npm run test && npm run build` xanh; có rollback trong migration.

## 6. KHÔNG đụng
- chat/agent, Topic, `bang-xep-hang`, dashboard quản lý, schema bảng `skills`/`module_skills` (chỉ đọc).
