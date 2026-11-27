-- =============================================================================
-- AI Tro Ly — user_saved_skills (Bộ kỹ năng cá nhân, FE-16)
-- Học xong 1 bài → người dùng tự bấm "Lưu skill" để giữ kỹ năng vào bộ cá nhân.
-- Thủ công (không tự động). Dùng lại bảng skills + module_skills (chỉ đọc).
-- RLS: chỉ chủ sở hữu đọc/ghi/xoá skill của mình. Idempotent + rollback ở cuối.
-- =============================================================================

create table if not exists public.user_saved_skills (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  skill_id         uuid not null references public.skills on delete cascade,
  source_module_id text,                       -- bài nào đã lưu (truy vết)
  saved_at         timestamptz not null default now(),
  unique (user_id, skill_id)                   -- mỗi skill chỉ lưu 1 lần / user
);

comment on table public.user_saved_skills is
  'Bộ kỹ năng cá nhân — skill người học tự lưu khi học xong bài (FE-16)';

create index if not exists user_saved_skills_user_idx
  on public.user_saved_skills (user_id);

alter table public.user_saved_skills enable row level security;

drop policy if exists user_saved_skills_select_own on public.user_saved_skills;
create policy user_saved_skills_select_own on public.user_saved_skills
  for select using (auth.uid() = user_id);

drop policy if exists user_saved_skills_insert_own on public.user_saved_skills;
create policy user_saved_skills_insert_own on public.user_saved_skills
  for insert with check (auth.uid() = user_id);

drop policy if exists user_saved_skills_delete_own on public.user_saved_skills;
create policy user_saved_skills_delete_own on public.user_saved_skills
  for delete using (auth.uid() = user_id);

-- ROLLBACK (manual):
-- drop policy if exists user_saved_skills_delete_own on public.user_saved_skills;
-- drop policy if exists user_saved_skills_insert_own on public.user_saved_skills;
-- drop policy if exists user_saved_skills_select_own on public.user_saved_skills;
-- drop table if exists public.user_saved_skills;
