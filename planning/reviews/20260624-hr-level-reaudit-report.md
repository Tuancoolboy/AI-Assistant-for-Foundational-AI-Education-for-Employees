# Report — HR assessment 5-level re-audit

- Ngày test: 2026-06-24 (Asia/Ho_Chi_Minh)
- Branch: `fix/hr-assessment-level-classification`
- Môi trường: local Next.js + Supabase real mode
- Run ID: `20260624-reaudit`
- Phạm vi: re-audit độc lập + P0 fixes (free-text UI, skipBasicModules override, monotonic invariant doc)

## Kết luận

Bug **đã hết**. 5/5 account PASS. Đã sửa 3 lỗ hổng P0 bổ sung.

## P0 đã sửa

| # | Vấn đề | Sửa | Files |
|---|--------|-----|-------|
| P0-A | Câu hỏi mở `q-hr-recurring` (free-text) bị tắt — flow gọi `includeFreeText=false`, `StepAssessment` không có nhánh textarea | Thêm nhánh render `type: "free-text"` (textarea, max 500 ký tự, sanitize HTML, optional). Đổi 3 lệnh gọi sang `includeFreeText=true` (default) | `onboarding-flow.tsx` |
| P0-B | Monotonic invariant chưa ghi nhận — `hasAgent && !hasAutomation` → L5 nhưng chưa document L5⊇L4 | Thêm JSDoc comment ghi rõ monotonic invariant; logic decision tree đã đúng (short-circuit) | `assessment-hr.ts` |
| P0-C | `skipBasicModules` lấy từ legacy total-score, không khớp HR `aiLevel` — HR L5 có thể có `skipBasicModules=false` | Override `skipBasicModules: aiLevel >= 5` trong `calculateHrAssessmentResult` | `assessment-hr.ts`, `assessment-hr.test.ts` |

## P1 — Quyết định (không thay đổi code)

| # | Vấn đề | Quyết định | Lý do |
|---|--------|------------|-------|
| P1-A | Ranh giới L2/L3: `promptSkill="2"` nên là L2 hay L3? | **Giữ L3** | Slides L3 = "Prompt có Context+Role+Format+Constraint". Option `"2"` = "Biết mô tả bối cảnh + yêu cầu cụ thể" — context-aware, gần L3 hơn L2. Option `"1"` = "Hỏi cơ bản" rõ ràng L2 |
| P1-B | Self-report L4/L5 chỉ 1 câu yes/no, dễ gian lận | **Giữ nguyên** | Assessment là diagnostic, không phải certification. False positive → lộ trình khó hơn (chấp nhận). Cohort ~15 user, chi phí thêm xác minh > lợi ích |

## P2 — Chờ scope

| # | Vấn đề | Trạng thái |
|---|--------|------------|
| P2-A | ≥16 câu (hiện 12 câu) | Chờ user chốt scope |
| P2-B | Generalize capability-gate cho role khác | Chờ user chốt scope |

## Kết quả 5 tài khoản

| Expected | Email | q4 Tần suất | q5 Prompt | q-hr-auto | q-hr-agent | q-hr-recurring (free-text) | Legacy score | `profiles.ai_level` | assessment `ai_level` | PASS/FAIL | Lý do |
|---:|---|---|---|---|---|---|---:|---:|---:|---|---|
| 1 | `codex.hr.level1.20260624-reaudit@test.local` | never | 0 (không biết) | no | no | _(trống)_ | 1 | 1 | 1 | **PASS** | Chưa dùng AI, không biết prompt → L1 Biết AI |
| 2 | `codex.hr.level2.20260624-reaudit@test.local` | weekly | 1 (cơ bản) | no | no | _(trống)_ | 8 | 2 | 2 | **PASS** | Dùng AI hàng tuần, hỏi cơ bản → L2 Dùng cơ bản |
| 3 | `codex.hr.level3.20260624-reaudit@test.local` | daily | 2 (bối cảnh) | no | no | Mỗi tuần sàng lọc ~40 CV vị trí sale | 15 | 3 | 3 | **PASS** | **REGRESSION**: dùng AI hằng ngày + prompt có bối cảnh + NO automation + NO agent → L3 (không bị đẩy L4) |
| 4 | `codex.hr.level4.20260624-reaudit@test.local` | daily | 4 (template) | yes | no | Cuối tháng tổng hợp báo cáo nhân sự cho sếp | 21 | 4 | 4 | **PASS** | Prompt template + đã nối AI với công cụ → L4 Tự động hóa |
| 5 | `codex.hr.level5.20260624-reaudit@test.local` | daily | 4 (template) | **no** | **yes** | Build agent tự sàng lọc CV và gửi kết quả qua Slack | 23 | 5 | 5 | **PASS** | **EDGE CASE monotonic**: agent=yes nhưng automation=no → L5 (agent hàm ý ≥L4) |

## Đáp án chi tiết (12 câu/account)

### Account L1
| Câu | Đáp án |
|-----|--------|
| q1-position | junior |
| q-hr-subfunction | hanh-chinh |
| q-hr-company-size | lt50 |
| q3hr-tasks | tuyen-dung |
| q-hr-priority | tuyen-dung |
| q-hr-data | hiem |
| q4-ai-frequency | never |
| q5-ai-skill | 0 |
| q6-ai-tools | _(không chọn)_ |
| q-hr-recurring | _(trống)_ |
| q-hr-automation | no |
| q-hr-agent | no |

### Account L2
| Câu | Đáp án |
|-----|--------|
| q1-position | mid |
| q-hr-subfunction | tong-hop |
| q-hr-company-size | 50-100 |
| q3hr-tasks | tuyen-dung, hop-dong-lao-dong |
| q-hr-priority | tuyen-dung |
| q-hr-data | thinh-thoang |
| q4-ai-frequency | weekly |
| q5-ai-skill | 1 |
| q6-ai-tools | chatgpt |
| q-hr-recurring | _(trống)_ |
| q-hr-automation | no |
| q-hr-agent | no |

### Account L3 (Regression case)
| Câu | Đáp án |
|-----|--------|
| q1-position | senior |
| q-hr-subfunction | tuyen-dung |
| q-hr-company-size | 100-200 |
| q3hr-tasks | tuyen-dung, bao-cao-nhan-su, dao-tao |
| q-hr-priority | tuyen-dung |
| q-hr-data | thuong-xuyen |
| q4-ai-frequency | daily |
| q5-ai-skill | 2 |
| q6-ai-tools | chatgpt, claude, gemini |
| q-hr-recurring | Mỗi tuần sàng lọc ~40 CV vị trí sale |
| q-hr-automation | no |
| q-hr-agent | no |

### Account L4
| Câu | Đáp án |
|-----|--------|
| q1-position | lead |
| q-hr-subfunction | hrbp-quan-ly |
| q-hr-company-size | gt200 |
| q3hr-tasks | tuyen-dung, bao-cao-nhan-su, quy-trinh-noi-bo, dao-tao |
| q-hr-priority | bao-cao-nhan-su |
| q-hr-data | thuong-xuyen |
| q4-ai-frequency | daily |
| q5-ai-skill | 4 |
| q6-ai-tools | chatgpt, claude, copilot, gemini |
| q-hr-recurring | Cuối tháng tổng hợp báo cáo nhân sự cho sếp |
| q-hr-automation | yes |
| q-hr-agent | no |

### Account L5 (Edge case: monotonic)
| Câu | Đáp án |
|-----|--------|
| q1-position | manager |
| q-hr-subfunction | hrbp-quan-ly |
| q-hr-company-size | gt200 |
| q3hr-tasks | tuyen-dung, bao-cao-nhan-su, quy-trinh-noi-bo, dao-tao, luong-thuong |
| q-hr-priority | quy-trinh-noi-bo |
| q-hr-data | thuong-xuyen |
| q4-ai-frequency | daily |
| q5-ai-skill | 4 |
| q6-ai-tools | chatgpt, claude, copilot, gemini, perplexity |
| q-hr-recurring | Build agent tự sàng lọc CV và gửi kết quả qua Slack |
| q-hr-automation | no |
| q-hr-agent | yes |

## Bằng chứng build

```
npm run lint   → 0 errors, 7 warnings (pre-existing)
npm run test   → 96 passed in 0.35s
npm run build  → ✓ Compiled successfully (Next.js 16.2.7 Turbopack)
```

## Downstream consistency check

| Consumer | Reads `aiLevel` from | `skipBasicModules` source | Correct? |
|----------|---------------------|---------------------------|----------|
| `use-app-profile.ts` | DB `profiles.ai_level` | `aiLevel >= 5` (derived) | ✅ |
| `recommender route` | Request body | `aiLevel >= 5` (derived) | ✅ |
| `path-recommendations-panel` | Props | `aiLevel >= 5` (derived) | ✅ |
| `getLearningModulesByRole` | Parameter | `aiLevel >= 5` (filter) | ✅ |
| `StepResult` (onboarding) | In-memory `result` | `result.skipBasicModules` | ✅ (fixed by P0-C) |
| `recommender.ts` `isEligible` | Input | `input.skipBasicModules` | ✅ |

## Cleanup

```bash
# Supabase SQL Editor hoặc psql với quyền admin
supabase/scripts/cleanup-hr-level-reaudit-20260624.sql
```
