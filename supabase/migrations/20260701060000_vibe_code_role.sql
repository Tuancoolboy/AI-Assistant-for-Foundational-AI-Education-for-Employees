-- =====================================================================
-- Migration: thêm vai trò "vibe-code" (khóa AI thực chiến K2 - Vibe code)
-- Nới ràng buộc role_id ở các bảng liên quan để nhận 'vibe-code'.
-- Giữ nguyên các vai trò cũ — chỉ bổ sung, không xóa.
-- =====================================================================

-- profiles.role_id (onboarding lưu vai trò học viên)
alter table public.profiles
  drop constraint if exists profiles_role_id_check;
alter table public.profiles
  add constraint profiles_role_id_check
  check (role_id in ('kinh-doanh','ke-toan','marketing','van-hanh','khac','nhan-su','vibe-code'));

-- learning_modules.role_id (seed bài học vibe-code nếu đẩy lên DB)
alter table public.learning_modules
  drop constraint if exists learning_modules_role_id_check;
alter table public.learning_modules
  add constraint learning_modules_role_id_check
  check (role_id in ('kinh-doanh','ke-toan','marketing','van-hanh','khac','nhan-su','vibe-code'));

-- onboarding_assessment_results.role_id (bài khảo sát sau khi chọn vai trò)
alter table public.onboarding_assessment_results
  drop constraint if exists onboarding_assessment_results_role_id_check;
alter table public.onboarding_assessment_results
  add constraint onboarding_assessment_results_role_id_check
  check (role_id in ('kinh-doanh','ke-toan','marketing','van-hanh','khac','nhan-su','vibe-code'));

-- extra_skill_lessons.source_role_id (lưu bài vibe-code vào "Kỹ năng khác")
alter table public.extra_skill_lessons
  drop constraint if exists extra_skill_lessons_source_role_id_check;
alter table public.extra_skill_lessons
  add constraint extra_skill_lessons_source_role_id_check
  check (source_role_id in ('kinh-doanh','ke-toan','marketing','van-hanh','khac','nhan-su','vibe-code'));

-- student_registrations.role_id (đăng ký học viên từ landing — forward-compat)
-- student_registrations có thể chưa tồn tại (landing đăng ký học viên làm sau) → guard IF EXISTS
alter table if exists public.student_registrations
  drop constraint if exists student_registrations_role_id_check;
alter table if exists public.student_registrations
  add constraint student_registrations_role_id_check
  check (role_id in ('kinh-doanh','ke-toan','marketing','van-hanh','khac','nhan-su','vibe-code'));
