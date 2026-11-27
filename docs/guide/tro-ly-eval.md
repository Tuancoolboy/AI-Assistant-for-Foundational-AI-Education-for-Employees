# Hướng Dẫn Chạy Eval `/tro-ly`

Tài liệu này mô tả cách chạy bộ eval thủ công cho trợ lý AI và cách đọc kết quả.

## Lệnh chạy

Chạy từ root repo:

```bash
npm run eval:tro-ly
```

Mặc định script gọi `http://localhost:3000`.

Nếu dev server chạy ở URL khác, đặt biến môi trường:

```bash
EVAL_BASE_URL=http://127.0.0.1:3000 npm run eval:tro-ly
```

## Điều kiện trước khi chạy

- `OPENAI_API_KEY` phải có giá trị hợp lệ.
- Dev server phải đang chạy.
- Nên dùng mode demo/openai để eval đi qua đường `/api/chat` thật.

## Kết quả sinh ra

Script ghi 2 file vào `eval/results/`:

- `tro-ly-eval-YYYY-MM-DD.json`
- `tro-ly-eval-YYYY-MM-DD.md`

## Cách đọc PASS/FAIL

Eval hiện dùng tiêu chí đơn giản cho từng ca:

- Đủ ý chính theo vai trò.
- Không còn `__CLARIFY__` ở lượt cuối.
- Không bị cắt cụt giữa chừng.

Trong file Markdown, mỗi ca có dòng `PASS/FAIL` riêng và bảng tổng hợp ở đầu file.

## Khi cần debug

- Nếu ca nào còn `FAIL`, mở file `.md` và đọc phần lượt 1/lượt 2.
- Nếu output còn cụt, tăng `max_tokens` ở đường tổng hợp cuối hoặc xem lại `finish_reason === "length"`.
- Nếu còn hỏi clarifying sau 3 câu, kiểm tra `finalizeClarifyingAssistantText()` và nhánh finalize sau clarify trong `src/frontend/lib/chat-clarify-parse.ts`.
