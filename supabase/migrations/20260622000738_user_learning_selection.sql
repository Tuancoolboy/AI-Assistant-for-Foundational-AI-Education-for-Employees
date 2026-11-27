-- =============================================================================
-- AI Tro Ly — user_learning_selection + cờ chốt lộ trình
-- Lưu tập bài người dùng tự chọn ở bước "chọn bài & chốt lộ trình" (composition)
-- trước màn 4 tier. Chốt 1 lần qua API server-side (set learning_path_confirmed_at).
-- RLS: user chỉ đọc/ghi/xoá lựa chọn của chính mình. Cờ chốt do API (anon, RLS) set.
-- =============================================================================

create table if not exists public.user_learning_selection (
  user_id    uuid not null references auth.users on delete cascade,
  module_id  text not null,
  source     text not null check (source in ('suggested', 'extra')),
  created_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

comment on table public.user_learning_selection is
  'Tập bài người học tự chọn (composition) trước màn 4 tier — chốt 1 lần';

alter table public.user_learning_selection enable row level security;

drop policy if exists uls_select_own on public.user_learning_selection;
create policy uls_select_own on public.user_learning_selection
  for select using (auth.uid() = user_id);

drop policy if exists uls_insert_own on public.user_learning_selection;
create policy uls_insert_own on public.user_learning_selection
  for insert with check (auth.uid() = user_id);

drop policy if exists uls_delete_own on public.user_learning_selection;
create policy uls_delete_own on public.user_learning_selection
  for delete using (auth.uid() = user_id);

-- Cờ chốt lộ trình (null = chưa chốt). Set bằng API khi user "Xác nhận lộ trình".
alter table public.profiles
  add column if not exists learning_path_confirmed_at timestamptz;

-- ROLLBACK (manual):
-- alter table public.profiles drop column if exists learning_path_confirmed_at;
-- drop table if exists public.user_learning_selection;
