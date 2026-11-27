# BE-14 — Chat Skill Gating + Cà khịa + Topic câu hỏi chưa có lời giải

> Phạm vi: CHỈ employee chat (`audience = "employee"`, có Supabase + OpenAI key). KHÔNG đụng manager chat, KHÔNG đụng demo mode.

## 1. Mục tiêu

Triết lý "cho cần câu, không cho con cá": trợ lý là gia sư mở khoá kỹ năng, không phải chatbot trả đáp án. Khi người học hỏi 1 vấn đề, hệ thống tra kho bài học (Nguồn 1 curriculum + Nguồn 1B extra-skill) rồi xử theo 3 case.

## 2. Ba case (gating decision)

| Case | Điều kiện | Hành vi |
|---|---|---|
| **A — answered-learned** | có bài phù hợp & `status = hoan-thanh` | cho đáp án thẳng + giọng cà khịa theo cấp (tăng theo `reask_count`), kèm link ôn lại |
| **B — must-learn** | có bài phù hợp & `chua-hoc`/`dang-hoc` | KHÔNG cho đáp án; định hướng học nhẹ nhàng; 2–3 bài để chọn |
| **C — no-lesson** | không bài nào đạt ngưỡng | trả lời khéo; auto-capture skill gap; mời đăng Topic |

**Ngưỡng:** `GATING_MIN_SCORE = 2` (curriculum score ≥ 2) **hoặc** có extra-skill match. Dưới ngưỡng cả 2 nguồn → CASE C (kể cả near-miss score 0<score<2).

## 3. Emotion map (CASE A) — `mapEmotion(reaskCount)`

| reaskCount (sau +1) | emotionLevel | sắc thái |
|---|---|---|
| 1 | 0 | trung tính, nhắc nhẹ |
| 2 | 1 | hơi trêu |
| 3 | 2 | cà khịa nhẹ, khinh khỉnh có duyên |
| ≥4 | 3 | khịa đậm nhưng dễ thương, vẫn giúp |

Khịa = gia vị: luôn kèm đáp án, không xúc phạm/doạ nạt. Mức khịa chỉ tăng theo `reask_count` của đúng `skill_key`.

## 4. skill_key

`skill_key = primary.skillSlug ?? primary.moduleId`. Curriculum module hiện không gắn skillSlug → fallback moduleId. Extra-skill có `skillSlug`.

## 5. Data model (migration `20260621132256_skill_gating_gaps_and_unsolved_topic.sql`)

- `skill_inquiry_counters` (per-user, unique `(user_id, skill_key)`) — đếm hỏi lại CASE A. Chỉ tăng khi answered-learned.
- `skill_gaps` — backlog NỘI BỘ auto-capture, dedup `(coalesce(org,sentinel), cluster_key)`. RLS: chỉ manager/admin org SELECT/UPDATE. Ghi bằng service role.
- `skill_gap_events` — log thô từng miss (suy `distinct_user_count`).
- `unsolved_questions` / `unsolved_question_helps` — Topic CỘNG ĐỒNG opt-in. RLS: cùng org SELECT; người đăng/manager accept; cộng `points_ledger` (`source='challenge'`, +15) cho helper khi accept.

**Atomic upsert** qua SECURITY DEFINER functions `bump_skill_inquiry_counter`, `capture_skill_gap` (chống lost update khi nhiều user hỏi cùng lúc — xem §10a prompt gốc).

## 6. Luồng route (`app/api/chat/route.ts`, nhánh employee)

1. Bỏ qua gating nếu đang clarify (`clarifyCompleted > 0` hoặc message là câu trả lời clarify).
2. Load modules + progress (`loadGatingModulesForUser`) → `findRelevantModulesForQuery` + `findExtraSkillLessonForQuery`.
3. Lấy skillKey ứng viên → `loadSkillInquiryCount` (nếu primary đã học) → `resolveSkillGating`.
4. `buildSkillGatingHint` nối vào `effectiveSystemPrompt` (sau clarifyHint).
5. Header `X-Skill-Gating: <decision>`.
6. CASE C: `captureSkillGap` (void, service role, fail-open) ngay; cập nhật `ai_attempt` sau stream.
7. CASE A: `bumpSkillInquiryCounter` sau stream.

## 7. API (Topic + backlog)

- `POST/GET /api/unsolved-questions`
- `POST /api/unsolved-questions/[id]/help`
- `POST /api/unsolved-questions/[id]/help/[helpId]/accept` → points
- `GET /api/skill-gaps` (manager) · `PATCH /api/skill-gaps/[id]` · `POST /api/skill-gaps/[id]/promote`
- Script `scripts/export-skill-gaps.ts` xuất backlog `status='new'`.

## 8. Guardrails

- Manager chat & demo mode KHÔNG đổi hành vi.
- Untrusted text (câu hỏi/đáp án) qua `sanitizePromptContextText` trước khi lưu/đưa prompt.
- Href chỉ nội bộ `/lo-trinh/...` từ data thật.
- `skill_gaps` không bao giờ lộ cho nhân viên thường (RLS manager-only).
- Promote validate `role_id` (5 vai trò module, không nhan-su) để không tạo module mồ côi.

## 9. Quyết định mở — `deep_answer` (lead chưa chốt)

Cờ `profiles.learning_profile.deepAnswer` (default **off**, ẩn UI). ON chỉ tăng độ sâu khi đã đủ điều kiện trả lời (CASE A), KHÔNG bypass luật gating. Hiện route truyền `false` → không đổi hành vi mặc định; chờ duyệt.

## Câu hỏi chưa giải đáp
- Cluster fuzzy chưa làm (chỉ token-sort dedup) — chấp nhận ở MVP.
- `deep_answer` chờ lead duyệt mới wire UI.
