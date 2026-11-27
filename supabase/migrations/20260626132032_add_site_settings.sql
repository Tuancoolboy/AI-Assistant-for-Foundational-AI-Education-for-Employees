-- Migration: Add site settings table
-- Description: Table to store site-wide settings with values in JSONB. Platform admins only.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and create new
DROP POLICY IF EXISTS site_settings_platform_admin_all ON public.site_settings;
CREATE POLICY site_settings_platform_admin_all ON public.site_settings
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Seed default values
INSERT INTO public.site_settings (key, value, description) VALUES
  ('enable_chat_eval', 'false', 'Bật/tắt đánh giá RAGAS tự động'),
  ('eval_model', '"gpt-4o-mini"', 'Model LLM dùng cho RAGAS evaluation'),
  ('faithfulness_alert_threshold', '0.7', 'Ngưỡng cảnh báo faithfulness'),
  ('chat_model', '"gpt-4o"', 'Model chính cho Chat Agent'),
  ('synthesis_model', '"gpt-4o"', 'Model tổng hợp cuối lượt chat'),
  ('grader_model', '"gpt-4o"', 'Model cho Grader Agent'),
  ('path_agent_model', '"gpt-4o-mini"', 'Model cho Learning Path Agent'),
  ('daily_message_limit', '30', 'Số lượt chat tối đa/người/ngày'),
  ('max_context_tokens', '8000', 'Số token tối đa gửi lên LLM'),
  ('max_history_messages', '10', 'Số tin nhắn lịch sử gửi kèm')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- DROP POLICY IF EXISTS site_settings_platform_admin_all ON public.site_settings;
-- DROP TABLE IF EXISTS public.site_settings;
