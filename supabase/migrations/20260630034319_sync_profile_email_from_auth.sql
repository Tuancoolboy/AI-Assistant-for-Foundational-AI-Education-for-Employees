-- Keep public.profiles.email in sync with auth.users.email.
-- Production had valid learning rows hidden from admin learning metrics because
-- older profile rows existed with NULL email.

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set
  email = au.email,
  updated_at = now()
from auth.users au
where p.id = au.id
  and au.email is not null
  and au.email <> ''
  and (p.email is null or p.email = '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  profile_phone text;
begin
  profile_name := nullif(
    trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )),
    ''
  );

  profile_phone := nullif(
    trim(coalesce(
      new.raw_user_meta_data ->> 'phone_number',
      new.raw_user_meta_data ->> 'phone',
      new.raw_user_meta_data ->> 'phoneNumber',
      ''
    )),
    ''
  );

  insert into public.profiles (id, email, full_name, phone_number)
  values (new.id, new.email, profile_name, profile_phone)
  on conflict (id) do update
    set
      email = coalesce(nullif(public.profiles.email, ''), excluded.email),
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      phone_number = coalesce(public.profiles.phone_number, excluded.phone_number);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    updated_at = now()
  where id = new.id
    and new.email is not null
    and new.email <> ''
    and (email is null or email = '' or email <> new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.handle_user_email_updated();

-- rollback
-- drop trigger if exists on_auth_user_email_updated on auth.users;
-- drop function if exists public.handle_user_email_updated();
