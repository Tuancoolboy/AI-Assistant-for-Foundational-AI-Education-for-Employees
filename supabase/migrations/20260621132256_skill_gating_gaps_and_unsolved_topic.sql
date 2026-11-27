-- =====================================================================
-- AI Tro Ly — Skill gating: counters + skill gaps backlog + unsolved topic
-- =====================================================================
-- Employee chat skill-gating (specs/BE-14):
--  - skill_inquiry_counters: đếm số lần hỏi lại 1 kỹ năng ĐÃ học (per user) → cà khịa tăng cấp.
--  - skill_gaps: backlog NỘI BỘ, auto-capture mọi câu miss → đầu vào ngân hàng skill (manager/admin xem).
--  - skill_gap_events: log thô từng lần miss (suy distinct_user_count).
--  - unsolved_questions / unsolved_question_helps: Topic CỘNG ĐỒNG opt-in, cộng điểm khi help được nhận.
-- Atomic upsert qua SECURITY DEFINER functions (chống lost update khi nhiều user hỏi cùng lúc).
-- Idempotent. RLS theo mẫu extra_skill_lessons / leaderboard_points. Có rollback ở cuối.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. skill_inquiry_counters — đếm lần hỏi lại theo skill (per user)
-- ---------------------------------------------------------------------
create table if not exists public.skill_inquiry_counters (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  skill_key       text not null,          -- skill_slug hoặc module_id
  module_id       text,                   -- bài khớp gần nhất (truy vết)
  skill_slug      text,
  reask_count     int not null default 0 check (reask_count >= 0),
  last_asked_at   timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (user_id, skill_key)
);

create index if not exists skill_inquiry_counters_user_idx
  on public.skill_inquiry_counters (user_id);

-- ---------------------------------------------------------------------
-- 2. skill_gaps — backlog nội bộ (auto-capture, đầu vào ngân hàng skill)
-- ---------------------------------------------------------------------
create table if not exists public.skill_gaps (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid references public.organizations on delete set null,
  role_id              text,
  cluster_key          text not null,         -- normalizeText(question)+role_id để gom trùng
  sample_question      text not null,         -- câu hỏi tiêu biểu (lần đầu thấy)
  last_question        text,                  -- câu hỏi gần nhất
  ai_attempt           text,                  -- câu trả lời khéo léo AI đã đưa (tham khảo)
  best_match_score     numeric not null default 0,
  suggested_skill_slug text,
  occurrence_count     int not null default 1 check (occurrence_count >= 1),
  distinct_user_count  int not null default 1,
  status               text not null default 'new'
                         check (status in ('new','triaged','in-progress','resolved','dismissed','duplicate')),
  resolved_module_id   text,
  triaged_by           uuid references auth.users on delete set null,
  resolved_at          timestamptz,
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now()
);

-- Dedup (organization_id, cluster_key). NULL org gom chung qua coalesce sentinel
-- (Postgres không coi NULL = NULL trong unique thường).
create unique index if not exists skill_gaps_org_cluster_uidx
  on public.skill_gaps (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    cluster_key
  );
create index if not exists skill_gaps_org_status_idx
  on public.skill_gaps (organization_id, status, occurrence_count desc);

-- 1 event/(gap,user) để đếm distinct_user_count atomic (NULL user_id không conflict →
-- nhiều miss ẩn danh không phá đếm). Append-only theo distinct user, không log mọi lần miss.
create table if not exists public.skill_gap_events (
  id            uuid primary key default gen_random_uuid(),
  skill_gap_id  uuid not null references public.skill_gaps on delete cascade,
  user_id       uuid references auth.users on delete set null,
  question      text not null,
  match_score   numeric not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists skill_gap_events_gap_idx
  on public.skill_gap_events (skill_gap_id);
create unique index if not exists skill_gap_events_gap_user_uidx
  on public.skill_gap_events (skill_gap_id, user_id);

-- ---------------------------------------------------------------------
-- 3. unsolved_questions — Topic cộng đồng (opt-in)
-- ---------------------------------------------------------------------
create table if not exists public.unsolved_questions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  organization_id  uuid references public.organizations on delete set null,
  skill_gap_id     uuid references public.skill_gaps on delete set null,
  role_id          text,
  question         text not null,
  ai_attempt       text,
  status           text not null default 'open'
                     check (status in ('open','answered','closed')),
  created_at       timestamptz not null default now()
);
create index if not exists unsolved_questions_org_status_idx
  on public.unsolved_questions (organization_id, status, created_at desc);

create table if not exists public.unsolved_question_helps (
  id               uuid primary key default gen_random_uuid(),
  question_id      uuid not null references public.unsolved_questions on delete cascade,
  helper_user_id   uuid not null references auth.users on delete cascade,
  answer           text not null,
  is_accepted      boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists unsolved_question_helps_question_idx
  on public.unsolved_question_helps (question_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.skill_inquiry_counters enable row level security;
alter table public.skill_gaps enable row level security;
alter table public.skill_gap_events enable row level security;
alter table public.unsolved_questions enable row level security;
alter table public.unsolved_question_helps enable row level security;

-- counters: chỉ chủ sở hữu (đọc; ghi đi qua service role function).
drop policy if exists skill_inquiry_counters_owner on public.skill_inquiry_counters;
create policy skill_inquiry_counters_owner on public.skill_inquiry_counters
  for select using (user_id = auth.uid());

-- skill_gaps / events: CHỈ manager/admin org được SELECT. Ghi đi qua service role.
drop policy if exists skill_gaps_select_manager on public.skill_gaps;
create policy skill_gaps_select_manager on public.skill_gaps
  for select using (
    (organization_id is not null and public.is_organization_manager(organization_id))
    -- Platform admin xem được mọi gap, kể cả null-org (user solo chưa thuộc tổ chức).
    or public.is_platform_admin()
  );
drop policy if exists skill_gaps_update_manager on public.skill_gaps;
create policy skill_gaps_update_manager on public.skill_gaps
  for update using (
    organization_id is not null and public.is_organization_manager(organization_id)
  )
  with check (
    organization_id is not null and public.is_organization_manager(organization_id)
  );

drop policy if exists skill_gap_events_select_manager on public.skill_gap_events;
create policy skill_gap_events_select_manager on public.skill_gap_events
  for select using (
    public.is_platform_admin()
    or exists (
      select 1 from public.skill_gaps g
      where g.id = skill_gap_id
        and g.organization_id is not null
        and public.is_organization_manager(g.organization_id)
    )
  );

-- unsolved_questions: thành viên cùng org đọc; người đăng insert/update của mình; manager update.
drop policy if exists unsolved_questions_select_org on public.unsolved_questions;
create policy unsolved_questions_select_org on public.unsolved_questions
  for select using (
    user_id = auth.uid()
    or (organization_id is not null and public.is_organization_member(organization_id))
  );
drop policy if exists unsolved_questions_insert_own on public.unsolved_questions;
create policy unsolved_questions_insert_own on public.unsolved_questions
  for insert with check (user_id = auth.uid());
drop policy if exists unsolved_questions_update_owner_or_manager on public.unsolved_questions;
create policy unsolved_questions_update_owner_or_manager on public.unsolved_questions
  for update using (
    user_id = auth.uid()
    or (organization_id is not null and public.is_organization_manager(organization_id))
  )
  with check (
    user_id = auth.uid()
    or (organization_id is not null and public.is_organization_manager(organization_id))
  );

-- helps: thành viên cùng org của câu hỏi đọc; người giúp insert của mình;
-- chỉ người đăng câu hỏi (hoặc manager) update is_accepted/status.
drop policy if exists unsolved_question_helps_select_org on public.unsolved_question_helps;
create policy unsolved_question_helps_select_org on public.unsolved_question_helps
  for select using (
    helper_user_id = auth.uid()
    or exists (
      select 1 from public.unsolved_questions q
      where q.id = question_id
        and (
          q.user_id = auth.uid()
          or (q.organization_id is not null and public.is_organization_member(q.organization_id))
        )
    )
  );
drop policy if exists unsolved_question_helps_insert_own on public.unsolved_question_helps;
create policy unsolved_question_helps_insert_own on public.unsolved_question_helps
  for insert with check (helper_user_id = auth.uid());
drop policy if exists unsolved_question_helps_update_owner on public.unsolved_question_helps;
create policy unsolved_question_helps_update_owner on public.unsolved_question_helps
  for update using (
    exists (
      select 1 from public.unsolved_questions q
      where q.id = question_id
        and (
          q.user_id = auth.uid()
          or (q.organization_id is not null and public.is_organization_manager(q.organization_id))
        )
    )
  );

-- ---------------------------------------------------------------------
-- Atomic upsert functions (chống lost update — specs/BE-14 §10a)
-- ---------------------------------------------------------------------

-- Tăng counter cho 1 kỹ năng (per user). Trả về reask_count mới.
create or replace function public.bump_skill_inquiry_counter(
  p_user_id   uuid,
  p_skill_key text,
  p_module_id text,
  p_skill_slug text
) returns int
language sql
security definer
set search_path = public
as $$
  insert into public.skill_inquiry_counters
    (user_id, skill_key, module_id, skill_slug, reask_count, last_asked_at)
  values (p_user_id, p_skill_key, p_module_id, p_skill_slug, 1, now())
  on conflict (user_id, skill_key) do update
    set reask_count   = public.skill_inquiry_counters.reask_count + 1,
        module_id     = coalesce(excluded.module_id, public.skill_inquiry_counters.module_id),
        skill_slug    = coalesce(excluded.skill_slug, public.skill_inquiry_counters.skill_slug),
        last_asked_at = now()
  returning reask_count;
$$;

-- Auto-capture 1 skill gap (atomic). Trả về id gap. distinct_user_count chỉ tăng
-- khi user này chưa từng xuất hiện trong gap đó (suy từ skill_gap_events).
create or replace function public.capture_skill_gap(
  p_organization_id uuid,
  p_role_id         text,
  p_cluster_key     text,
  p_question        text,
  p_match_score     numeric,
  p_suggested_skill_slug text,
  p_user_id         uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gap_id uuid;
  v_occurrence int;
  v_event_inserted int;
begin
  insert into public.skill_gaps
    (organization_id, role_id, cluster_key, sample_question, last_question,
     best_match_score, suggested_skill_slug, occurrence_count, distinct_user_count)
  values
    (p_organization_id, p_role_id, p_cluster_key, p_question, p_question,
     coalesce(p_match_score, 0), p_suggested_skill_slug, 1, 1)
  on conflict (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), cluster_key)
  do update
    set occurrence_count = public.skill_gaps.occurrence_count + 1,
        last_question    = excluded.last_question,
        last_seen_at     = now(),
        best_match_score = greatest(public.skill_gaps.best_match_score, excluded.best_match_score)
  returning id, occurrence_count into v_gap_id, v_occurrence;

  -- Unique (skill_gap_id, user_id) làm việc "user mới?" atomic: chỉ row mới mới insert.
  insert into public.skill_gap_events (skill_gap_id, user_id, question, match_score)
  values (v_gap_id, p_user_id, p_question, coalesce(p_match_score, 0))
  on conflict (skill_gap_id, user_id) do nothing;
  get diagnostics v_event_inserted = row_count;

  -- Tăng distinct khi: event là user mới (vừa insert) + user thật + gap ĐÃ tồn tại trước
  -- (occurrence > 1 ⇒ user đầu tiên đã được tính = 1 lúc insert gap, không double-count).
  if v_event_inserted = 1 and p_user_id is not null and v_occurrence > 1 then
    update public.skill_gaps
      set distinct_user_count = distinct_user_count + 1
      where id = v_gap_id;
  end if;

  return v_gap_id;
end;
$$;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- drop function if exists public.capture_skill_gap(uuid,text,text,text,numeric,text,uuid);
-- drop function if exists public.bump_skill_inquiry_counter(uuid,text,text,text);
-- drop table if exists public.unsolved_question_helps;
-- drop table if exists public.unsolved_questions;
-- drop table if exists public.skill_gap_events;
-- drop table if exists public.skill_gaps;
-- drop table if exists public.skill_inquiry_counters;
