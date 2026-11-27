-- =====================================================================
-- AI Trợ Lý — Thêm cột published vào learning_modules (Phase 4)
-- =====================================================================
-- Mục đích: thay lọc tên "[GỘP…" bằng cột boolean tường minh.
-- default true = toàn bộ bài hiện có vẫn hiển thị, không bị ẩn nhầm.
-- Idempotent: dùng DO block kiểm tra trước khi thêm.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  = 'learning_modules'
      AND column_name = 'published'
  ) THEN
    ALTER TABLE public.learning_modules
      ADD COLUMN published boolean NOT NULL DEFAULT true;
  END IF;
END;
$$;

COMMENT ON COLUMN public.learning_modules.published IS
  'false = bài bị ẩn khỏi pool (thay thế lọc theo tên "[GỘP…"). '
  'Default true = bài cũ an toàn; sync từ Notion set false để ẩn bài gộp/rác.';

CREATE INDEX IF NOT EXISTS learning_modules_published_idx
  ON public.learning_modules (published);

-- =====================================================================
-- ROLLBACK (chạy thủ công nếu cần lùi):
-- DROP INDEX IF EXISTS public.learning_modules_published_idx;
-- ALTER TABLE public.learning_modules DROP COLUMN IF EXISTS published;
-- =====================================================================
