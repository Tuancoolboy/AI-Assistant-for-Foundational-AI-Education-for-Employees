-- =====================================================================
-- AI Tro Ly — Migration 20260623104942: learning entitlements
-- =====================================================================
-- Source of truth for paid/trial learning access.
-- - scope_type='user': individual entitlement.
-- - scope_type='organization': company entitlement.
-- Existing profiles.learning_activated remains legacy/admin history only.
-- =====================================================================

create table if not exists public.learning_entitlements (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('user','organization')),
  scope_id uuid not null,
  status text not null default 'trial'
    check (status in ('trial','active','blocked','expired')),
  trial_module_limit integer not null default 3
    check (trial_module_limit >= 0 and trial_module_limit <= 100),
  source text not null default 'manual',
  notes text,
  activated_by uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.learning_entitlements is
  'Quyền học trả phí/trial theo user hoặc organization; thay thế gate learning_activated';
comment on column public.learning_entitlements.scope_type is
  'user = quyền cá nhân, organization = quyền doanh nghiệp';
comment on column public.learning_entitlements.scope_id is
  'UUID của auth.users.id hoặc organizations.id tùy scope_type';
comment on column public.learning_entitlements.status is
  'trial/active/blocked/expired cho quyền học hiện tại';

create unique index if not exists learning_entitlements_current_scope_idx
  on public.learning_entitlements (scope_type, scope_id)
  where ended_at is null;

create index if not exists learning_entitlements_scope_status_idx
  on public.learning_entitlements (scope_type, scope_id, status);

alter table public.learning_entitlements enable row level security;

-- No anon/user mutation policy by design. Server Route Handlers and admin scripts
-- use the service role after checking platform/manager context.

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- drop index if exists public.learning_entitlements_scope_status_idx;
-- drop index if exists public.learning_entitlements_current_scope_idx;
-- drop table if exists public.learning_entitlements;
