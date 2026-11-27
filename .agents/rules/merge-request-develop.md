---
description: "Bắt buộc mọi AI agent tạo merge request (PR) vào nhánh develop — không merge thẳng main/develop"
activation: always-on
---

# Merge Request vào `develop` — Bắt buộc

> Áp dụng **mọi** AI agent/tool trong repo: Cursor, Claude Code, Codex, Gemini CLI, Antigravity, Copilot, v.v.
> Canonical source: file này. Mirror Cursor: `.cursor/rules/merge-request-develop.mdc`.

## Nguyên tắc

Mọi thay đổi code (feature, fix, refactor, chore có code) **phải đi qua merge request (MR/PR) vào nhánh `develop`**.

- **Base branch của MR/PR:** luôn là `develop`
- **Không** merge thẳng vào `main` / `master` trừ khi user yêu cầu rõ (hotfix production có phê duyệt)
- **Không** push commit feature trực tiếp lên `develop` hoặc `main`
- **Không** báo task xong mà chưa có MR/PR vào `develop` (hoặc chưa hướng dẫn user mở MR nếu agent không được quyền push)

Liên quan: bắt đầu nhánh từ `develop` → `.agents/rules/agent-workflow.md` §1.

## Quy trình chuẩn (sau khi code + verify xong)

```bash
# 1. Đảm bảo đang ở nhánh feature (không phải develop/main)
git status

# 2. Commit trên nhánh feature (chỉ khi user yêu cầu commit)
git add ...
git commit -m "..."

# 3. Push nhánh feature lên remote
git push -u origin HEAD

# 4. Tạo MR/PR vào develop
gh pr create --base develop --title "..." --body "..."
```

**Target branch:** `--base develop` (bắt buộc). Không dùng `--base main` trừ khi user chỉ định.

## Khi nào được bỏ qua MR

Chỉ khi user **nói rõ** một trong các trường hợp:

- Hotfix production khẩn cấp vào `main` (hiếm; vẫn nên backport qua `develop` sau)
- Chỉ sửa docs local / không push
- User tự merge và chỉ cần agent chuẩn bị nhánh + diff

Nếu repo remote **chưa có** nhánh `develop`, báo user và dùng nhánh integration đã thống nhất (thường vẫn không merge thẳng `main`).

## Nội dung MR tối thiểu

- **Title:** conventional — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Body:** tóm tắt thay đổi + test plan (lint/test/build đã chạy)
- **Reviewer:** để trống trừ khi user chỉ định

## Checklist trước khi mở MR

1. Nhánh feature tách từ `develop` mới nhất (hoặc đã rebase/merge `develop` gần đây)
2. `npm run lint`, `npm run test`, `npm run build` pass — xem `AGENTS.md` Verification
3. Docs đã cập nhật — `specs/PROJECT-CONTINUATION.md`, `WORKLOG.md` nếu cần
4. MR **base = `develop`**, compare từ nhánh feature → `develop`
5. Trả user **URL MR/PR** sau khi tạo xong

## Agent không được push / không có `gh`

- Chuẩn bị sẵn: tên nhánh, commit message, title/body MR
- Hướng dẫn user chạy `git push` + `gh pr create --base develop ...`
- **Không** kết luận "đã ship" khi chưa có MR vào `develop`
