-- Reset mentor QA accounts for re-test.
-- Run in Supabase SQL Editor with service/admin permissions.
--
-- Expected accounts:
-- - qa.report.01@cohort2.vn: onboarded accounting learner for app/core tests.
-- - qa.report.fresh@cohort2.vn: fresh learner for onboarding/auth redirect tests.
--
-- This script does not create Auth users or set passwords. Create/confirm the
-- two users in Supabase Auth first if they do not exist.

do $$
declare
  onboarded_email text := 'qa.report.01@cohort2.vn';
  fresh_email text := 'qa.report.fresh@cohort2.vn';
  onboarded_id uuid;
  fresh_id uuid;
begin
  select id into onboarded_id from auth.users where email = onboarded_email;
  select id into fresh_id from auth.users where email = fresh_email;

  if onboarded_id is not null then
    insert into public.profiles (
      id,
      email,
      full_name,
      role_id,
      ai_level,
      daily_tasks,
      assessment_result,
      learning_activated,
      learning_activated_at,
      learning_path_confirmed_at,
      updated_at
    )
    values (
      onboarded_id,
      onboarded_email,
      'QA Report 01',
      'ke-toan',
      2,
      array['ke-toan-hoa-don', 'ke-toan-cong-no'],
      jsonb_build_object(
        'aiLevel', 2,
        'levelLabel', 'Đã biết cơ bản',
        'dailyTasks', array['ke-toan-hoa-don', 'ke-toan-cong-no']
      ),
      true,
      now(),
      now(),
      now()
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      role_id = excluded.role_id,
      ai_level = excluded.ai_level,
      daily_tasks = excluded.daily_tasks,
      assessment_result = excluded.assessment_result,
      learning_activated = excluded.learning_activated,
      learning_activated_at = excluded.learning_activated_at,
      learning_path_confirmed_at = excluded.learning_path_confirmed_at,
      updated_at = excluded.updated_at;

    delete from public.module_progress where user_id = onboarded_id;
    delete from public.quiz_results where user_id = onboarded_id;
    delete from public.time_logs where user_id = onboarded_id;
  end if;

  if fresh_id is not null then
    insert into public.profiles (
      id,
      email,
      full_name,
      role_id,
      ai_level,
      daily_tasks,
      assessment_result,
      learning_activated,
      learning_path_confirmed_at,
      updated_at
    )
    values (
      fresh_id,
      fresh_email,
      'QA Report Fresh',
      null,
      0,
      null,
      null,
      false,
      null,
      now()
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      role_id = null,
      ai_level = 0,
      daily_tasks = null,
      assessment_result = null,
      learning_activated = false,
      learning_path_confirmed_at = null,
      updated_at = now();

    delete from public.module_progress where user_id = fresh_id;
    delete from public.quiz_results where user_id = fresh_id;
    delete from public.time_logs where user_id = fresh_id;
    delete from public.user_learning_selection where user_id = fresh_id;
    delete from public.user_roadmap where user_id = fresh_id;
    delete from public.user_skill_groups where user_id = fresh_id;
  end if;
end $$;

select
  u.email,
  p.role_id,
  p.assessment_result is not null as has_assessment,
  p.learning_path_confirmed_at is not null as path_confirmed
from auth.users u
left join public.profiles p on p.id = u.id
where u.email in ('qa.report.01@cohort2.vn', 'qa.report.fresh@cohort2.vn')
order by u.email;
