-- =====================================================================
-- AI Trợ Lý — Migration 20260626120000: chat evaluations
-- =====================================================================
-- Lưu kết quả đánh giá chất lượng RAGAS cho từng phiên chat của user.
-- =====================================================================

create table if not exists public.chat_evaluations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  faithfulness numeric(3,2),
  faithfulness_reasoning text,
  answer_relevancy numeric(3,2),
  answer_relevancy_reasoning text,
  context_recall numeric(3,2),
  context_recall_reasoning text,
  overall_score numeric(3,2),
  eval_model text,
  evaluated_at timestamptz not null default now()
);

comment on table public.chat_evaluations is 'Kết quả đánh giá chất lượng câu trả lời AI (faithfulness, relevancy, recall)';

create index if not exists chat_evaluations_user_idx on public.chat_evaluations (user_id);
create index if not exists chat_evaluations_conversation_idx on public.chat_evaluations (conversation_id);

alter table public.chat_evaluations enable row level security;

drop policy if exists chat_evaluations_select_own on public.chat_evaluations;
create policy chat_evaluations_select_own on public.chat_evaluations
  for select using (auth.uid() = user_id);

drop policy if exists chat_evaluations_insert_own on public.chat_evaluations;
create policy chat_evaluations_insert_own on public.chat_evaluations
  for insert with check (auth.uid() = user_id);
