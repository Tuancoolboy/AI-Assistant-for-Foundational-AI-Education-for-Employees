-- =====================================================================
-- AI Trợ Lý — Nới learning_modules.level từ 1-3 lên 1-4 (4 tier FE-15)
-- =====================================================================
-- Lộ trình 4 tier: Cơ bản → Nâng cao → Nâng trình → Master (specs/FE-15).
-- Notion "Thư viện bài học HR" hiện có 3 cấp (Lvl 1-3); nới lên 4 để sẵn sàng
-- khi thêm "Lvl 4 · Master". Idempotent. Có rollback ở cuối.
-- =====================================================================

alter table public.learning_modules
  drop constraint if exists learning_modules_level_check;

alter table public.learning_modules
  add constraint learning_modules_level_check
  check (level between 1 and 4);

comment on column public.learning_modules.level is
  'Cấp độ / tier bài học: 1=Cơ bản, 2=Nâng cao, 3=Nâng trình, 4=Master (FE-15)';

-- =====================================================================
-- ROLLBACK (chạy thủ công nếu cần lùi):
-- alter table public.learning_modules
--   drop constraint if exists learning_modules_level_check;
-- alter table public.learning_modules
--   add constraint learning_modules_level_check check (level between 1 and 3);
-- =====================================================================
