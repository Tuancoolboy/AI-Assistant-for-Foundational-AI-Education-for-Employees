-- =====================================================================
-- AI Trợ Lý — LMS Roadmap Opt-out: skill_groups + user_skill_groups + user_roadmap
-- Thiết kế: docs/system-architecture-lms-roadmap.md (§1–§4)
-- Mô hình: Nhóm Kỹ năng → 4 cấp → Bài; auto-populate; checkbox opt-out (is_selected);
-- khóa phạm vi cấp Nhóm (RLS + trigger cột bất biến); % chỉ đếm is_selected=true.
-- Idempotent; có block ROLLBACK ở cuối. Postgres 17 (security_invoker hỗ trợ).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. skill_groups (root entity — Nhóm Kỹ năng)
-- ---------------------------------------------------------------------
create table if not exists public.skill_groups (
  slug        text primary key,
  role_id     text not null,
  label       text not null,
  description text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);
create index if not exists skill_groups_role_idx on public.skill_groups (role_id, sort_order);

-- ---------------------------------------------------------------------
-- 2. Backfill learning_modules.skill_slug cho MỌI bài published.
--    Seed (learning-modules-data.ts) đã gán skill_slug = skills[0] cho phần lớn bài.
--    Bài còn NULL → gán nhóm placeholder '{role_id}-khac' để KHÔNG rớt auto-populate.
--    (Red-team: gate "published AND skill_slug IS NULL = 0" — placeholder bảo đảm pass.)
-- ---------------------------------------------------------------------
alter table public.learning_modules
  add column if not exists skill_slug text;

update public.learning_modules
set skill_slug = role_id || '-khac'
where coalesce(published, true) = true
  and (skill_slug is null or skill_slug = '');

-- ---------------------------------------------------------------------
-- 3. Seed skill_groups TỪ chính learning_modules (DRY, role_id luôn đồng nhất 3 nguồn).
--    distinct on (skill_slug) → 1 role_id/slug, tránh trùng PK khi slug dùng chéo vai trò.
--    Nhãn: tra bảng label tạm (HR + generic); fallback initcap(slug).
-- ---------------------------------------------------------------------
with known_labels(slug, label) as (
  values
    ('hr-nen-tang','Nền tảng Claude cho HR'),
    ('hr-tuyen-dung','Tuyển dụng & sàng lọc ứng viên'),
    ('hr-onboarding-ld','Onboarding & Đào tạo (L&D)'),
    ('hr-cb-luong','C&B, tính lương & phúc lợi'),
    ('hr-hieu-suat','Đánh giá hiệu suất & KPI/OKR'),
    ('hr-quan-he-chinh-sach','Quan hệ lao động & chính sách'),
    ('hr-hanh-chinh-ops','HR Ops, hành chính & soạn thảo'),
    ('hr-phan-tich-du-lieu','Phân tích dữ liệu HR & báo cáo'),
    ('hr-tu-dong-hoa','Tự động hóa & năng suất HR'),
    ('nen-tang-ai','Nền tảng AI cơ bản'),
    ('viet-prompt','Viết prompt hiệu quả'),
    ('an-toan-du-lieu','An toàn dữ liệu khi dùng AI'),
    ('van-ban-hanh-chinh','Soạn văn bản hành chính'),
    ('loc-cv','Lọc CV tuyển dụng'),
    ('email-noi-bo','Viết email nội bộ'),
    ('cham-cong-nghi-phep','Chấm công & nghỉ phép'),
    ('tom-tat-tai-lieu','Tóm tắt tài liệu & biên bản'),
    ('danh-gia-chinh-sach','Đánh giá & chính sách nhân sự'),
    ('phan-tich-du-lieu-ns','Phân tích dữ liệu nhân sự'),
    ('cb-tinh-luong','C&B & kiểm tra bảng lương'),
    ('dao-tao-ld','Thiết kế đào tạo / L&D')
),
distinct_groups as (
  select distinct on (skill_slug) skill_slug, role_id
  from public.learning_modules
  where skill_slug is not null and skill_slug <> ''
  order by skill_slug, role_id
)
insert into public.skill_groups (slug, role_id, label, sort_order, is_active)
select dg.skill_slug,
       dg.role_id,
       coalesce(kl.label,
                case when dg.skill_slug like '%-khac'
                     then 'Khác / chưa phân loại'
                     else initcap(replace(dg.skill_slug, '-', ' ')) end),
       0,
       true
from distinct_groups dg
left join known_labels kl on kl.slug = dg.skill_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 4. FK learning_modules.skill_slug → skill_groups(slug). NULLable (bài chưa tag).
--    on delete set null — nhưng skill_groups CẤM hard-delete (chỉ is_active=false).
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'learning_modules_skill_slug_fkey'
      and table_name = 'learning_modules'
  ) then
    alter table public.learning_modules
      add constraint learning_modules_skill_slug_fkey
      foreign key (skill_slug) references public.skill_groups(slug) on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. user_skill_groups (khóa phạm vi — nguồn sự thật quyền)
-- ---------------------------------------------------------------------
create table if not exists public.user_skill_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  skill_slug  text not null references public.skill_groups(slug),
  source      text not null check (source in ('onboarding','admin')),
  assigned_by uuid references auth.users,
  is_active   boolean not null default true,        -- soft-remove (admin gỡ nhóm)
  assigned_at timestamptz default now(),
  unique (user_id, skill_slug)
);
create index if not exists user_skill_groups_user_idx on public.user_skill_groups (user_id);

-- ---------------------------------------------------------------------
-- 6. user_roadmap (junction lộ trình cá nhân + is_selected opt-out)
-- ---------------------------------------------------------------------
create table if not exists public.user_roadmap (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  module_id   text not null references public.learning_modules(id) on delete cascade,
  skill_slug  text not null references public.skill_groups(slug),
  is_selected boolean not null default true,
  source      text not null default 'onboarding' check (source in ('onboarding','admin')),
  added_at    timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, module_id)
);
create index if not exists user_roadmap_user_sel_idx on public.user_roadmap (user_id, is_selected);
create index if not exists user_roadmap_user_group_idx on public.user_roadmap (user_id, skill_slug);

-- ---------------------------------------------------------------------
-- 7. populate_roadmap_for_group — phủ kín trọn bộ bài published của 1 nhóm.
--    SECURITY DEFINER (owner ghi user_roadmap vượt RLS); idempotent; trả ĐÚNG count.
-- ---------------------------------------------------------------------
create or replace function public.populate_roadmap_for_group(
  p_user uuid, p_slug text, p_source text
) returns int
language sql
security definer
set search_path = public
as $$
  with ins as (
    insert into public.user_roadmap (user_id, module_id, skill_slug, is_selected, source)
    select p_user, lm.id, lm.skill_slug, true, p_source
    from public.learning_modules lm
    where lm.skill_slug = p_slug and coalesce(lm.published, true) = true
    on conflict (user_id, module_id) do nothing   -- giữ is_selected user đã chỉnh
    returning 1
  )
  select count(*)::int from ins;
$$;

-- ---------------------------------------------------------------------
-- 8. Trigger khóa cột bất biến trên user_roadmap: user chỉ đổi is_selected/updated_at.
--    RLS không tự diễn đạt "cột không đổi" → chặn user UPDATE skill_slug/source thoát phạm vi.
--    Bỏ qua khi đang ở vai service_role (admin/populate).
-- ---------------------------------------------------------------------
create or replace function public.user_roadmap_lock_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;  -- service-role (populate/admin) được sửa tự do
  end if;
  if new.user_id is distinct from old.user_id
     or new.module_id is distinct from old.module_id
     or new.skill_slug is distinct from old.skill_slug
     or new.source is distinct from old.source
     or new.added_at is distinct from old.added_at then
    raise exception 'user_roadmap: chỉ được cập nhật is_selected';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_roadmap_lock_columns_trg on public.user_roadmap;
create trigger user_roadmap_lock_columns_trg
  before update on public.user_roadmap
  for each row execute function public.user_roadmap_lock_columns();

-- ---------------------------------------------------------------------
-- 9. View user_group_progress — % theo nhóm, mẫu số = is_selected=true.
--    security_invoker=on (PG15+) → kế thừa RLS, KHÔNG leak chéo user.
-- ---------------------------------------------------------------------
create or replace view public.user_group_progress
with (security_invoker = on) as
select r.user_id,
       r.skill_slug,
       count(*) filter (where r.is_selected) as total_selected,
       count(*) filter (where r.is_selected and mp.status = 'hoan-thanh') as completed,
       case when count(*) filter (where r.is_selected) > 0
            then round(100.0 * count(*) filter (where r.is_selected and mp.status = 'hoan-thanh')
                       / count(*) filter (where r.is_selected))
            else 0 end as percent
from public.user_roadmap r
left join public.module_progress mp
  on mp.user_id = r.user_id and mp.module_id = r.module_id
group by r.user_id, r.skill_slug;

-- ---------------------------------------------------------------------
-- 10. RLS (§4.2)
-- ---------------------------------------------------------------------
alter table public.skill_groups      enable row level security;
alter table public.user_skill_groups enable row level security;
alter table public.user_roadmap      enable row level security;

drop policy if exists "read skill groups" on public.skill_groups;
create policy "read skill groups" on public.skill_groups
  for select using (auth.role() = 'authenticated');

drop policy if exists "read own groups" on public.user_skill_groups;
create policy "read own groups" on public.user_skill_groups
  for select using (auth.uid() = user_id);
-- (KHÔNG có policy INSERT/UPDATE/DELETE cho user → chỉ service-role ghi)

drop policy if exists "read own roadmap" on public.user_roadmap;
create policy "read own roadmap" on public.user_roadmap
  for select using (auth.uid() = user_id);

-- user CHỈ UPDATE is_selected, CHỈ trên bài thuộc nhóm đang sở hữu (active).
-- USING (row cũ) + WITH CHECK (row mới) — ngăn đổi skill_slug để thoát phạm vi.
drop policy if exists "toggle own roadmap in owned groups" on public.user_roadmap;
create policy "toggle own roadmap in owned groups" on public.user_roadmap
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_skill_groups g
      where g.user_id = auth.uid()
        and g.skill_slug = user_roadmap.skill_slug
        and g.is_active = true
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_skill_groups g
      where g.user_id = auth.uid()
        and g.skill_slug = user_roadmap.skill_slug
        and g.is_active = true
    )
  );

-- ---------------------------------------------------------------------
-- 11. Migrate dữ liệu cũ: user_learning_selection → user_roadmap.
--     Chỉ user đã chốt onboarding (learning_path_confirmed_at IS NOT NULL).
--     source 'suggested'/'extra' → 'onboarding'; lọc bài skill_slug NULL (cột NOT NULL).
-- ---------------------------------------------------------------------
insert into public.user_roadmap (user_id, module_id, skill_slug, is_selected, source)
select uls.user_id, uls.module_id, lm.skill_slug, true, 'onboarding'
from public.user_learning_selection uls
join public.learning_modules lm on lm.id = uls.module_id
join public.profiles p on p.id = uls.user_id
where lm.skill_slug is not null
  and p.learning_path_confirmed_at is not null
on conflict (user_id, module_id) do nothing;

-- Backfill user_skill_groups (suy từ tập skill_slug đã chọn của mỗi user).
insert into public.user_skill_groups (user_id, skill_slug, source, is_active)
select distinct r.user_id, r.skill_slug, 'onboarding', true
from public.user_roadmap r
on conflict (user_id, skill_slug) do nothing;

-- Phủ kín legacy user: chạy populate cho mỗi (user, nhóm) → thêm bài thiếu (is_selected=true),
-- KHÔNG ghi đè is_selected bài user đã có (on conflict do nothing).
do $$
declare rec record;
begin
  for rec in select distinct user_id, skill_slug from public.user_skill_groups loop
    perform public.populate_roadmap_for_group(rec.user_id, rec.skill_slug, 'onboarding');
  end loop;
end;
$$;

-- =====================================================================
-- ROLLBACK (chạy thủ công nếu cần lùi):
-- DROP VIEW IF EXISTS public.user_group_progress;
-- DROP TRIGGER IF EXISTS user_roadmap_lock_columns_trg ON public.user_roadmap;
-- DROP FUNCTION IF EXISTS public.user_roadmap_lock_columns();
-- DROP FUNCTION IF EXISTS public.populate_roadmap_for_group(uuid, text, text);
-- DROP TABLE IF EXISTS public.user_roadmap;
-- DROP TABLE IF EXISTS public.user_skill_groups;
-- ALTER TABLE public.learning_modules DROP CONSTRAINT IF EXISTS learning_modules_skill_slug_fkey;
-- DROP TABLE IF EXISTS public.skill_groups;
-- =====================================================================
