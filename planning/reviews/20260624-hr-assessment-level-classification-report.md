# Report — HR assessment 5-level classification

- Ngày test: 2026-06-24 (Asia/Ho_Chi_Minh)
- Branch: `fix/hr-assessment-level-classification`
- Môi trường: local Next.js + Supabase real mode
- Run ID: `20260624-0945`
- Phạm vi cuối: giữ bộ HR cũ, append 2 câu capability gate; email đã xác nhận, tài khoản đã kích hoạt học.

## Kết luận

Bug được xác nhận và đã sửa.

Logic cũ cộng điểm từ thâm niên nghề, tần suất dùng AI và số công cụ/tác vụ đã
thử, sau đó cắt ngưỡng tổng điểm. Vì vậy một HR Level 3 dùng AI hằng ngày, làm
quản lý hoặc đã thử nhiều tool có thể bị đẩy thành Level 4 dù chưa từng tự động
hóa workflow.

Logic cuối dùng wrapper HR riêng theo framework trong
`ai-troly-slides-toi-nay.md`:

1. Level 1 — Biết AI.
2. Level 2 — Dùng AI cơ bản.
3. Level 3 — Viết prompt có Context + Role + Format + Constraint.
4. Level 4 — Phải có cả khai báo năng lực automation và use case đã kết nối AI
   với Sheets/Lark/Zapier/n8n để workflow tự chạy.
5. Level 5 — Phải có cả khai báo năng lực agent và use case agent nhiều bước có
   tool/điều kiện/giám sát.

Shared `assessment.ts`, total score và `skipBasicModules` không thay đổi.
Prompt proficiency chỉ đưa tới tối đa Level 3. Level 4/5 phải có câu trả lời
`yes` ở gate automation/agent mới.

## Kết quả 5 tài khoản

| Expected | Email | `profiles.ai_level` | DB assessment | Legacy skip | Trạng thái |
|---:|---|---:|---:|---:|---|
| 1 | `codex.hr.level1.20260624-0945@test.local` | 1 | 1 | false | PASS |
| 2 | `codex.hr.level2.20260624-0945@test.local` | 2 | 2 | false | PASS |
| 3 | `codex.hr.level3.20260624-0945@test.local` | 3 | 3 | false | PASS |
| 4 | `codex.hr.level4.20260624-0945@test.local` | 4 | 4 | false | PASS |
| 5 | `codex.hr.level5.20260624-0945@test.local` | 5 | 5 | true | PASS |

Tất cả 5 account có `email_confirmed_at`, `learning_activated=true`, role lưu
thành `nhan-su` và có đúng một bản ghi assessment cuối cùng.

## Câu trả lời quyết định level

| Email | Tần suất AI | Kỹ năng prompt cũ | Automation gate | Agent gate | Kết quả |
|---|---|---|---|---|---:|
| `codex.hr.level1.20260624-0945@test.local` | Chưa bao giờ | Không biết prompt | No | No | 1 |
| `codex.hr.level2.20260624-0945@test.local` | Vài lần/tuần | Hỏi cơ bản | No | No | 2 |
| `codex.hr.level3.20260624-0945@test.local` | Hằng ngày | Bối cảnh + yêu cầu cụ thể | No | No | 3 |
| `codex.hr.level4.20260624-0945@test.local` | Hằng ngày | Prompt template | Yes | No | 4 |
| `codex.hr.level5.20260624-0945@test.local` | Hằng ngày | Prompt template | Yes | Yes | 5 |

## Regression quan trọng

Account Level 3 dùng AI hằng ngày và biết prompt có bối cảnh, nhưng trả lời
`No` cho cả automation và agent.

Kết quả vẫn là Level 3. Đây là case tái hiện trực tiếp lỗi Level 3 bị đánh giá
thành Level 4.

## Cleanup

Chạy file:

```bash
# Supabase SQL Editor hoặc psql với quyền admin
supabase/scripts/cleanup-hr-assessment-test-accounts-20260624.sql
```

Việc xóa ở `auth.users` sẽ cascade các dữ liệu user-scoped liên quan.
