-- AI Tro Ly — Seed skills + module_skills cho lộ trình Kế toán.
-- Bài học kế toán chưa có row trong module_skills → nút "Lưu skill" không lưu được
-- và /bo-ky-nang luôn trống với role này. Seed theo đúng pattern migration
-- 20260611110000 (van-hanh).

-- Kỹ năng mới đặc thù kế toán (dùng chung, organization_id null)
insert into public.skills (organization_id, name, slug, description, is_foundation)
values
  (null, 'Xử lý & đối chiếu hóa đơn', 'xu-ly-hoa-don', 'Kiểm tra, phân loại, phát hiện hóa đơn trùng/lệch bằng AI', false),
  (null, 'Trích xuất số liệu chứng từ', 'trich-xuat-chung-tu', 'Lấy số liệu từ chứng từ & PDF bằng AI', false),
  (null, 'Phát hiện số liệu bất thường', 'phat-hien-bat-thuong', 'Rà soát dữ liệu tài chính bất thường với AI', false),
  (null, 'Đối chiếu công nợ & nhắc thu hồi', 'doi-chieu-cong-no', 'Xếp tuổi nợ, soạn email nhắc thu hồi bằng AI', false),
  (null, 'Lập báo cáo quản trị', 'bao-cao-quan-tri', 'Tổng hợp báo cáo quản trị nhanh bằng AI', false)
on conflict do nothing;

-- Gắn kỹ năng cho 8 bài kế toán (reuse kỹ năng nền tảng đã seed ở 20260611110000)
insert into public.module_skills (module_id, skill_id)
select m.module_id, s.id
from (values
  ('ke-toan-m1', 'nen-tang-ai'),
  ('ke-toan-m2', 'xu-ly-hoa-don'),
  ('ke-toan-m3', 'tom-tat-tai-lieu'),
  ('ke-toan-m4', 'trich-xuat-chung-tu'),
  ('ke-toan-m5', 'phat-hien-bat-thuong'),
  ('ke-toan-m6', 'an-toan-du-lieu'),
  ('ke-toan-m7', 'doi-chieu-cong-no'),
  ('ke-toan-m8', 'bao-cao-quan-tri')
) as m(module_id, slug)
join public.skills s on s.slug = m.slug and s.organization_id is null
on conflict do nothing;

-- ROLLBACK
-- delete from public.module_skills where module_id like 'ke-toan-m%';
-- delete from public.skills where slug in
--   ('xu-ly-hoa-don','trich-xuat-chung-tu','phat-hien-bat-thuong','doi-chieu-cong-no','bao-cao-quan-tri');
