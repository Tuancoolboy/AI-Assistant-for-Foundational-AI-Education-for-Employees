---
title: "LMS Roadmap Opt-out (Nhóm Kỹ năng + 4 cấp + checkbox)"
description: "Chuyển LMS từ opt-in (nhặt bài, chốt 1 lần) sang opt-out (auto-populate trọn bộ bài theo Nhóm Kỹ năng, checkbox bỏ tích, % chỉ đếm bài đã tích)."
status: completed
priority: P2
branch: "develop"
tags: [lms, roadmap, supabase, opt-out]
blockedBy: []
blocks: []
created: "2026-06-28T03:07:11.988Z"
createdBy: "ck:plan"
source: skill
---

# LMS Roadmap Opt-out (Nhóm Kỹ năng + 4 cấp + checkbox)

## Overview

Triển khai thiết kế trong `docs/system-architecture-lms-roadmap.md`: phân cấp **Nhóm Kỹ năng → 4 cấp → Bài**,
**auto-populate** lộ trình khi chọn nhóm (onboarding/admin), **checkbox opt-out** (`is_selected`), khóa phạm vi
ở cấp Nhóm (RLS + anti-greedy UI), % chỉ đếm bài `is_selected=true`.

**Quyết định đã chốt:** (1) L4+L5 gộp Master (4 cấp); (2) 1 bài thuộc đúng 1 nhóm (`skill_slug` cột đơn);
(3) tách `is_selected` (`user_roadmap`) khỏi `status` (`module_progress`).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Migration & Schema](./phase-01-migration-schema.md) | ✅ Done |
| 2 | [API Endpoints](./phase-02-api-endpoints.md) | ✅ Done |
| 3 | [Frontend Roadmap UI](./phase-03-frontend-roadmap-ui.md) | ✅ Done |
| 4 | [Admin & Test](./phase-04-admin-test.md) | ✅ Done |

## Dependencies

- **Tuần tự**: P1 → P2 → P3; P4 (admin endpoints + e2e) phụ thuộc P2+P3.
- **Tài liệu nguồn**: `docs/system-architecture-lms-roadmap.md` (ERD, công thức %, RLS, hợp đồng API).
- **Liên quan sprint** `planning/sprints/20260624-ghep-devbug-noidung/`: Phase-0 freemium. **Quyết định:** roadmap
  này **bỏ khóa/paywall** — mọi bài truy cập được, % đạt 100% tự nhiên (không loại trừ mẫu số).
- **EM (ngoài repo)**: sync Notion→Supabase phải giữ `skill_slug` cho mọi bài mới (để auto-populate phủ kín).
</content>
