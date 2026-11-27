-- =====================================================================
-- AI Trợ Lý — Nới learning_modules.level từ 1-4 lên 1-5 (Phase-3: L5 Master+)
-- =====================================================================
-- Tier 5 "Master+" được thêm vào FE (learning-tiers.ts) và cần DB cho phép
-- level=5 để EM sync bài m65–73, m86. UI đã hỗ trợ L5 trước khi migration này
-- được áp dụng (phối hợp đồng thời Phase-3). Idempotent. Có rollback ở cuối.
-- =====================================================================

alter table public.learning_modules
  drop constraint if exists learning_modules_level_check;

alter table public.learning_modules
  add constraint learning_modules_level_check
  check (level between 1 and 5);

comment on column public.learning_modules.level is
  'Cấp độ bài học: 1=Cơ bản, 2=Nâng cao, 3=Nâng trình, 4=Master, 5=Master+ (Phase-3)';

-- =====================================================================
-- ROLLBACK (chạy thủ công nếu cần lùi về 1-4):
-- alter table public.learning_modules
--   drop constraint if exists learning_modules_level_check;
-- alter table public.learning_modules
--   add constraint learning_modules_level_check check (level between 1 and 4);
-- comment on column public.learning_modules.level is
--   'Cấp độ / tier bài học: 1=Cơ bản, 2=Nâng cao, 3=Nâng trình, 4=Master (FE-15)';
-- =====================================================================
