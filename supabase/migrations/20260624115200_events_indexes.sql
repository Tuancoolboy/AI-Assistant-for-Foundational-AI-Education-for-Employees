-- Add index for grouping events by created_at date (helps with stalled logic and metrics)
create index if not exists events_created_at_idx on public.events (created_at desc);

-- Keep the existing events_user_event_created_idx which is useful for `lastActivityAt` lookup per user
-- We also add a simpler index on user_id and created_at just in case it is faster for purely fetching timeline
create index if not exists events_user_created_idx on public.events (user_id, created_at desc);

-- rollback
-- drop index if exists public.events_user_created_idx;
-- drop index if exists public.events_created_at_idx;
