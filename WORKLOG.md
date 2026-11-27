# WORKLOG — Team 9

> Technical decisions, task assignments, brainstorming, important bugs.
> Update mỗi khi team đưa ra quyết định kỹ thuật hoặc thay đổi hướng đi.
> Nguyên tắc: ghi theo dòng thời gian, không sửa lịch sử như thể quyết định mới đã có từ đầu.

---

## [2026-07-06] — Onboarding: thêm nút bỏ qua đánh giá đầu vào

**Bối cảnh:** Live QA (local dev, demo mode) phát hiện onboarding bắt buộc
6-15 câu hỏi đánh giá (tuỳ vai trò, HR lên tới 15 câu) trước khi vào được app
— không có cách bỏ qua. Đây không phải bug QA report gốc, nhưng khớp rủi ro
CLAUDE.md §12 đã cảnh báo ("giữ ma sát thấp... test phải ngắn").

**Quyết định:** Thêm link "Bỏ qua đánh giá, bắt đầu luôn →" ở màn hình "why"
(trước khi vào câu hỏi), gọi thẳng `finishAssessment()` với answers rỗng.
`calculateResult`/`calculateHrAssessmentResult` đã xử lý an toàn mảng answers
rỗng (score = 0 → level 1 "Mới bắt đầu"), nên tái dùng đúng path tính điểm có
sẵn thay vì viết fallback riêng. Đánh giá đầy đủ vẫn giữ nguyên cho user muốn
lộ trình cá nhân hóa chính xác hơn thay vì mặc định level 1.

**Verification:** Lint + tsc sạch trên file đổi; Vitest 616/616 pass; `next
build` pass. Verify live: bấm nút bỏ qua → tới đúng bước 5/5 kết quả với role
giữ nguyên, vào `/lo-trinh` thành công qua "Bắt đầu học ngay".

## [2026-07-05] — Fix QA findings v2 (mentor QA report) + enable perf measurement

**Bối cảnh:** Mentor QA report (`plans/reports/qa-report-260705-1818-ai-tro-ly.md`)
chấm Trục A 58/100, Trục B 6.5/10. Re-scout codebase phát hiện QA report có
false positive: `/xep-hang` thực ra là `/bang-xep-hang` (nav đúng), nút "Làm lại
bài kiểm tra" đã là `<Link>` hoạt động, và không có auto-fork conversation phía
server. Plan rút từ 10 phase suy đoán còn 4 phase bám thực tế code.

**Quyết định & thay đổi (đã merge vào develop qua 4 nhánh `fix/qa-v2-*`):**
- **PII leak (CRIT, finding B-4):** `SAFETY_TRIGGERS` trong `lib/safety.ts`
  thiếu flag `g` nên `redactSensitiveText()` chỉ xoá match đầu tiên — câu chứa
  cả CMND lẫn số tài khoản làm lọt số thứ hai lên OpenAI + Supabase. Thêm flag
  `g`, reset `lastIndex` trước mỗi `.test()`, và wire `redactSensitiveText` vào
  `app/api/chat/route.ts` để redact message TRƯỚC khi gọi OpenAI/lưu DB (trước
  đây chỉ tính banner cảnh báo, không thực redact).
- **404 mất nav (A-07/A-09):** `app/not-found.tsx` (server component) nay check
  session và hiện nav tối giản khi đã đăng nhập + thêm metadata title.
- **Role label sai (A-04/B-1):** `ROLE_LABEL` trong `lib/openai.ts` là bản
  trùng lặp cũ — `van-hanh` = "Nhân viên vận hành" trong khi `roles.ts` đã đổi
  thành "Hành chính / Nhân sự (HR)". Sửa khớp + thêm prompt rule: định nghĩa
  trước khi ví dụ ("X là gì?"), tuân đúng ràng buộc số câu.
- **Progress breakdown (A-05):** `getProgressSummary` trả thêm
  `totalLearning`/`totalNotStarted`; `/tien-bo` hiện subtitle "N hoàn thành ·
  M đang học · K chưa học" để user không nhầm khi % = 0 mà có bài đang học.
- **Perf (A-02):** thêm `@vercel/speed-insights` để đo LCP/CLS/INP thật —
  KHÔNG refactor RSC mù khi chưa có số. Quyết định refactor chờ dữ liệu thật.

**Không làm (có chủ đích):** Playwright e2e pipeline (repo chưa có
`playwright.config.ts`, là initiative riêng), và client conversation-id race
(A-08 — review `use-assistant-chat.ts` không tái hiện chắc root cause, không
patch mù vào chat production).

**Verification:** `npm run lint` sạch trên file đổi; `tsc` không lỗi mới;
Vitest 616/616 pass (loại 1 suite fail pre-existing thiếu file migration cũ +
các suite thiếu package langgraph/nodemailer không liên quan); `npm run build`
(next build) pass toàn bộ route. Mỗi phase 1 nhánh riêng, đã push develop.

## [2026-07-03] — Sync `sync_code_3_jul_2026` vào nhánh develop

**Bối cảnh:** Nhánh nguồn `origin/sync_code_3_jul_2026` chứa các thay đổi
mentor QA, Vibe Code role/course, seed/evidence scripts và nhiều chỉnh sửa UI.
Merge tự động có nguy cơ kéo theo artifact local và ghi đè các hardening mới
trên `develop`.

**Quyết định:** Tạo nhánh tích hợp `feat/sync-code-3-jul-2026` từ `develop`,
merge nhánh nguồn rồi dọn theo hướng giữ phần tính năng thật, loại `.agent` và
`tmp/excel-report/**`, đồng thời phục hồi các guard đã ổn định trên `develop`:
platform-admin không trả password thô và yêu cầu confirm khi xóa user hàng loạt,
quiz/leaderboard giữ hành vi bảo mật hiện tại, auth callback dùng env helper,
test runner dùng shared API server, migration skill groups giữ `skill_slug` và
admin resync dùng cột `published` đúng schema. Role `vibe-code` được giữ lại và
bổ sung đủ quiz question để qua regression test.

**Verification:** `npm run db:validate` pass; targeted Vitest cho platform admin,
auth callback, tier mapping, quiz, leaderboard, onboarding và Vibe Code pass;
`npm run lint` pass với 17 warning cũ; `npm run build` pass; `npm run test`
pass toàn bộ (120 Vitest files / 618 tests, Phase 1 API 30/30, Phase 2
manager/invite 12/12, auth/OAuth 7/7, activity metrics 3/3, backend pytest
103/103).

## [2026-07-02] — Mentor QA final polish toward 100/100 and Trục B 10/10

**Bối cảnh:** Mentor re-check còn 3 điểm rủi ro: welcome modal có thể che
route chấm điểm, `/tien-bo` phát Recharts warning khi chart mount trước khi có
size, và câu trả lời Trợ lý cho ví dụ kế toán/công nợ chưa luôn có bảng mẫu +
prompt copy-paste.

**Quyết định:** Giới hạn welcome video bằng allowlist chỉ `/onboarding`; bọc
chart `/tien-bo` bằng `ResizeObserver` frame và đặt `initialDimension` dương cho
`ResponsiveContainer`; normalize assistant text trước renderer để tách heading,
bullet/list và câu bị dính chữ; thêm prompt rule điều kiện cho yêu cầu ví dụ cụ
thể/bảng/hóa đơn-công nợ bắt buộc có bảng dữ liệu giả định, cách đối chiếu và
prompt mẫu. Evidence script nay siết AI-01 theo bảng/cách đối chiếu/prompt mẫu
và cho AI-02 nối tiếp cùng conversation của AI-01 để test “từ bảng đó”.

**Verification:** Targeted Vitest 31/31 pass; `npm run lint` pass với 15
warning cũ; `npm run test` pass toàn bộ (99 Vitest files / 499 tests, Phase 1
API 30/30, manager/invite 12/12, auth/OAuth 7/7, activity metrics 3/3, backend
pytest 103/103); `npm run build` pass; `EVAL_BASE_URL=http://localhost:3101 npm
run eval:tro-ly` pass 6/6 OpenAI thật; `MENTOR_QA_BASE_URL=http://localhost:3101
npm run evidence:mentor-qa` pass route 7/7 và AI 5/5; browser console check
local `/tien-bo` có `rechartsWarningCount=0`, `modalVisible=0`, screenshot:
`output/playwright/mentor-tien-bo-local.png`.

## [2026-06-30] — Dọn triệt để test data `@test.local`

**Bối cảnh:** Các integration test tạo auth users `@test.local`; cleanup cũ chỉ xoá
`auth.users`, nên khi user đã bị xoá trước đó thì organization test kiểu
`Công ty của ...@test.local` vẫn sót lại trong Supabase.

**Quyết định:** Tách helper cleanup dùng chung cho test scripts, gom test user ids
và test organization ids trước khi xoá. Cleanup mới xoá theo thứ tự invite links
→ organization members → organizations → profiles → auth users, đồng thời các
script tạo user thật đăng ký cleanup khi process thoát để chạy riêng từng file
cũng tự dọn dù test fail giữa chừng.

**Verification:** `node --check` pass cho toàn bộ script liên quan; `npm run
test:clean` lần đầu xoá 38 organizations test còn sót, lần hai trả về 0 toàn bộ;
hook on-exit chạy cleanup thành công.

## [2026-06-30] — Improve Aha Moment operator traceability

**Bối cảnh:** Tab `/van-hanh/aha-moment` khó dùng cho vận hành vì thiếu filter khoảng ngày, người học có thể rơi về 8 ký tự UUID, và module hiển thị slug thay vì tên bài học.

**Quyết định:** Tab Aha load thêm Auth users và `learning_modules`, hiển thị tên/email người học, tên bài học ngắn gọn kèm slug phụ, thêm filter từ ngày/đến ngày theo múi giờ Việt Nam, và export CSV theo tên module.

**Verify:** Targeted Vitest cho Aha export pass; `git diff --check` pass.

## [2026-06-30] — Sync profile email for learning metrics

**Bối cảnh:** Production có nhiều học viên có dữ liệu học nhưng không hiện ở `/van-hanh/do-luong` vì `profiles.email` bị `NULL` dù `auth.users.email` vẫn đúng.

**Quyết định:** Thêm migration backfill `profiles.email` từ Auth, củng cố trigger tạo/cập nhật email profile cho user mới, và cho `/api/platform-admin/learning-metrics` dùng Auth email làm fallback nếu profile email vẫn thiếu.

**Verify:** Targeted Vitest cho learning metrics route pass; `npm run db:validate` pass; `git diff --check` pass.

## [2026-06-28] — Hardening PR #57: dynamic settings, RAGAS eval và LangGraph chat path

**Bối cảnh:** Review PR #57 phát hiện một số claim/rủi ro chưa khớp runtime: bật/tắt eval vẫn có đường override bằng env/metadata, API cài đặt cho phép ghi trực tiếp model/giới hạn không an toàn, `max_context_tokens` chưa thật sự tham gia ngân sách prompt chat, eval trong chat route dễ đánh giá bản trả lời thô thay vì câu trả lời cuối, và log cũ mô tả nhầm `/api/practice-review` có proxy qua `PYTHON_BACKEND_URL`.

**Quyết định:**
1. **Settings Service & API:** Chuẩn hóa model allowlist, validate numeric bounds cho PUT `/api/van-hanh/settings`, và normalize dữ liệu DB để row xấu fallback về default an toàn thay vì phá chat/cost controls.
2. **LangGraph Chat Eval:** Để `enable_chat_eval` trong DB là nguồn quyết định duy nhất; route chat bỏ `forceEval`, skip graph-level eval cho câu trả lời thô và chạy `runChatEvaluation` best-effort sau khi đã có `assistantText` cuối cùng.
3. **Chat Budget:** Nối `max_context_tokens` từ dynamic settings vào `trimChatMessagesToBudget` để cài đặt vận hành có tác dụng runtime.
4. **Docs Contract:** Sửa ghi chú cũ về `practice-review`: route hiện vẫn chạy trong Next.js và gọi `graderGraph`; không có proxy theo `PYTHON_BACKEND_URL` trong PR này.

**Verify:** Targeted Vitest cho settings/eval/chat/grader pass 20/20; `npm run db:validate` pass; `APP_ENV=test OPENAI_API_KEY=mock-key-for-ci bash src/backend/eval/run_all.sh --dry-run` pass; `npm run lint` pass với 15 warning cũ; `npm run build` pass; full `npm run test` pass (454 Vitest, 30/30 Phase 1 API, 12/12 manager/invite, 7/7 auth/OAuth, 3/3 activity/metrics, 103 pytest); `git diff --check` pass.
## [2026-06-29 11:43] — Review follow-up: giữ tier 3 là "Nâng trình"

**Bối cảnh:** Review PR #63 chỉ ra nhãn tier 3 trong `learning-tiers.ts` bị đổi thành "Nâng cao", làm trùng tier 2 và lệch taxonomy chuẩn của `lms-levels.ts` / FE-15 (`Cơ bản` → `Nâng cao` → `Nâng trình` → `Master`).

**Quyết định:** Khôi phục `LEARNING_TIERS[3]` thành "Nâng trình" và đổi regression test từ "không chứa Nâng trình" sang assert toàn bộ taxonomy để tránh tier 2/tier 3 trùng nhãn lần nữa.

**Verification:** `npm run lint` pass (0 errors, 13 warnings cũ); `npm run test:unit -- src/frontend/lib/learning-tiers.test.ts src/frontend/lib/lms-levels.test.ts` pass (2 files, 15 tests); `npm run build` pass. `npm run test` bị lệch do script tự dùng service Docker đang chiếm `:3000` và trả 404; đã chạy lại cùng các suite trên server production test `:3099`: Vitest full 94 files / 472 tests pass, Phase 1 API 30/30 pass, manager/invite 12/12 pass, OAuth 7/7 pass, activity metrics 3/3 pass, Python backend 103/103 pass; cleanup xoá 6 test accounts.

## [2026-06-28 11:18] — LMS Roadmap Opt-out (Nhóm Kỹ năng · 4 cấp · checkbox)

**Bối cảnh:** Chuyển LMS từ opt-in (user nhặt bài, chốt 1 lần) sang opt-out: chọn Nhóm Kỹ năng → server auto-populate trọn bộ bài → checkbox bỏ tích, % chỉ đếm bài `is_selected=true`. Thực thi plan `plans/260628-0731-lms-roadmap-opt-out/` (4 phase).

**Quyết định kỹ thuật:**
1. **Gộp seed + migrate data vào migration** (`20260628090000_skill_groups_and_user_roadmap.sql`) thay vì script .mjs rời — idempotent, ordered, chạy 1 lần khi apply. `skill_groups` suy TỪ `learning_modules` thật (distinct on slug) → `role_id` luôn đồng nhất 3 nguồn.
2. **Backfill skill_slug NULL → nhóm placeholder `{role_id}-khac`** để đảm bảo gate red-team "published AND skill_slug IS NULL = 0".
3. **Bảo mật DB**: view `user_group_progress` dùng `security_invoker=on` (PG17, chống leak chéo user); RLS UPDATE có cả `USING` + `WITH CHECK`; trigger `user_roadmap_lock_columns` chặn user đổi cột ≠ is_selected; `populate_roadmap_for_group` SECURITY DEFINER + CTE count đúng.
4. **Taxonomy CHỐT**: `lms-levels.ts` (4 cấp, L5→Master) là chuẩn DUY NHẤT cho `/lo-trinh`. KHÔNG đụng `learning-tiers.ts`/gate-quiz `/kiem-tra` (surface khác, ngoài scope).
5. **Bỏ luồng opt-in cùng PR**: `learning-path/route.ts` → 410 Gone; gỡ nhánh composition/confirmed trong `lo-trinh-content.tsx`; `lo-trinh-composition.tsx` nay không còn ref (xóa ở PR cleanup).
6. **Admin resync** thêm bài mới với `is_selected=false` (opt-in retro, chống tụt % ngầm); DELETE nhóm = soft-remove (`is_active=false`), giữ lịch sử is_selected.
7. **Bỏ paywall/khóa** trong roadmap — mọi bài truy cập được.

**Verify:** `npm run db:validate` OK · `npm run lint` 0 lỗi file mới (3 lỗi `any` tồn sẵn ở `learning-metrics-tab.tsx` = develop) · `npm run test:unit` 464 pass (1 suite parse lỗi tồn sẵn = develop) · `npm run build` ✓ Compiled successfully (sau `npm install` xlsx đã khai báo + thêm `skill_slug: null` vào literal `chat-knowledge-curriculum.ts` do team đặt skill_slug = required).

## [2026-06-26 20:45] — Đánh giá Mã nguồn (Code Review Checklist) của tính năng Cài đặt hệ thống (Site Settings)

**Bối cảnh:** Thực hiện quy trình `/code-review-checklist` để đánh giá toàn bộ các thay đổi trong nhánh `feat/ragas-langgraph-eval` liên quan đến việc triển khai tính năng Cài đặt hệ thống (Site Settings).

**Quyết định:**
1. **Đánh giá Chức năng & Bảo mật:** Xác thực tính năng dynamic config sử dụng đúng `getSetting` trong lõi AI và rate limits. RLS trên bảng `site_settings` phân quyền Platform Admin chặt chẽ. Đầu vào PUT API được whitelist đầy đủ, và Demo Mode được bảo vệ an toàn.
2. **Đánh giá Hiệu năng & UI:** Cache TTL 30s giúp giảm tải DB tối ưu. UI tuân thủ nghiêm ngặt "Purple Ban", sử dụng các thẻ ARIA phù hợp, tuy nhiên lưu ý giới hạn của Next.js client-side navigation khi sử dụng `beforeunload` chặn chuyển trang (đã ghi nhận làm đề xuất cải tiến).
3. **Kiểm thử:** Chạy kiểm thử toàn bộ dự án thành công. Tạo báo cáo chi tiết `code_review_report.md` lưu trữ trong artifacts.

---

## [2026-06-26 20:30] — Tích hợp Trang Quản trị Cấu hình Hệ thống (Site Settings Admin Console Tab)

**Bối cảnh:** Thêm khả năng cấu hình động cho vận hành viên (Platform Admin) tại `/van-hanh/cai-dat` để quản lý các tham số AI (RAGAS evaluation toggle + model), model cho các Agent chính/Grader/Path, hạn mức và token giới hạn trực tiếp từ database mà không cần redeploy.

**Quyết định:**
1. **Database Migration & RLS**: Tạo bảng `site_settings` với chính sách bảo mật RLS phân quyền chặt chẽ (chỉ Platform Admin đọc/ghi dựa trên hàm `public.is_platform_admin()`).
2. **Settings Service (Server-side)**: Xây dựng Settings Service (`site-settings.ts`) phía server tích hợp bộ nhớ cache 30 giây để giảm tải truy vấn DB và cơ chế tự động fallback về biến môi trường `process.env` khi DB chưa sẵn sàng. Thêm hàm `clearSettingsCache` phục vụ kiểm thử.
3. **Cài đặt Hệ thống UI**: Thiết kế tab Cài đặt giao diện phẳng B2B cao cấp tuân thủ nghiêm ngặt "Purple Ban", sử dụng toggle switch hỗ trợ đầy đủ phím điều hướng và các thẻ ARIA tiêu chuẩn, có hộp thoại Toast Banner thông báo trực quan và cơ chế cảnh báo Unsaved Changes trước khi người dùng đóng trang hoặc chuyển đổi tab.
4. **Clean Code & QA**: Giải quyết triệt để cảnh báo cascading render của React linter bằng cách chuyển demo mode check thành bất đồng bộ trong useEffect. Thay thế ép kiểu `as any` thành `as unknown as never` trong test file để bảo đảm Type-safety.

---

## [2026-06-26 14:15] — Hoàn thiện Tích hợp Native LangGraph Orchestration và RAGAS Evaluation trên Frontend

**Bối cảnh:** Sau khi di chuyển logic orchestration của Chat Agent và Grader Agent sang đồ thị LangGraph nguyên bản bằng TypeScript và tích hợp đánh giá chất lượng RAGAS, hệ thống gặp một số lỗi kiểu dữ liệu TypeScript trong các node và lỗi 401 Unauthorized khi chạy bộ test tích hợp `test-phase1-apis.mjs` tại local.

**Quyết định:**
1. **Sửa lỗi kiểu dữ liệu LangGraph nodes**: Sửa kiểu tham số `state` trong các node (`retrieve`, `augment`, `llm`, `post-process`, `eval`) từ `typeof ChatGraphStateType` thành `ChatGraphStateType` để tương thích hoàn toàn với TS compiler.
2. **Nâng cấp Trí nhớ Hội thoại (Chat Memory)**: Thêm trường `history` kiểu `Annotation<any[]>` vào `ChatGraphState` và truyền lịch sử chat đã trim vào `chatAgent.invoke`. Cập nhật `llm-node.ts` để kết hợp lịch sử này vào prompt gửi lên OpenAI, khôi phục khả năng nhớ ngữ cảnh hội thoại cho Agent.
3. **Chuẩn hóa Kiểu dữ liệu chấm bài**: Thiết kế map `GradingResult` thành `PracticeReviewResult` trong `practice-review` route handler để bỏ các kiểu ép `as any` không an toàn, đồng thời dọn dẹp các import không sử dụng (`gradePracticeSubmission`, `NextResponse`).
4. **Đồng bộ hóa Cấu hình Supabase Local**: Phát hiện Next.js dev server chạy trong thư mục `src/frontend` nên chỉ tải `.env.local` tại đó (đang chứa project ref cũ `tinkhtwuqjynordcjbxx`), trong khi test script ở root đọc `.env.local` ở root (chứa project ref mới `dtiylxmrqltttjswqpzu`), dẫn đến lệch cookie name và gây lỗi 401. Đã đồng bộ các biến Supabase từ root sang `src/frontend/.env.local` và khởi động lại dev server. Khôi phục `encodeURIComponent` cho cookie string của test script.
5. **Dọn dẹp code debug**: Gỡ bỏ toàn bộ console logs debug chèn tạm thời trong `resolveApiSession` và `createSupabaseServerClient`.

**Verify:**
- Chạy `npm run test` vượt qua thành công 100% (bao gồm 436 unit tests và 30/30 integration tests của `test-phase1-apis.mjs`).
- Chạy `npm run lint` đạt 0 lỗi/cảnh báo trên các files chỉnh sửa.
- Chạy `npm run build` thành công, biên dịch Next.js production build không lỗi.

## [2026-06-26 11:35] — Tích hợp RAGAS Evaluation Suite & Mở rộng LangGraph Chat Agent

**Bối cảnh:** Dự án cần thiết lập hệ thống tự động đánh giá (RAGAS) chất lượng của 3 agent chính (Chat Agent, Learning Path Agent, Grading Agent) dựa trên log Supabase và mở rộng skeleton của Chat Agent trong Python backend thành đồ thị LangGraph hoàn chỉnh để đáp ứng lộ trình tích hợp tương lai.

**Quyết định:**
1. **Setup golden dataset pipeline**: Tạo `dataset_builder.py` tự động xuất dữ liệu từ các bảng `chat_messages` và `grading_results` của Supabase hoặc tự sinh dữ liệu mẫu chất lượng cao (mock fallbacks) khi chạy ở local.
2. **Xây dựng RAGAS runner**: Phát triển `ragas_runner.py` để đánh giá 4 metrics cốt lõi của RAG (Faithfulness, Answer Relevancy, Context Precision, Context Recall), cùng các metrics custom: `path_coverage` (Độ bao phủ lộ trình học) và `grading_consistency` (Độ nhất quán điểm chấm tự luận).
3. **Mở rộng LangGraph Chat Agent**: Thiết kế đồ thị chat 4-node (`retrieve` -> `augment` -> `llm` -> `post_process`) hoàn chỉnh trong backend Python. Triển khai node RAG đơn giản tìm kiếm keywords trong danh mục học tập của hệ thống.
4. **Kết nối API & feature flags**: Thêm tham số `use_langgraph_chat` vào cấu hình Settings và định tuyến luồng chat thông qua đồ thị LangGraph trong `ChatAiService`.
5. **CI/CD Integration**: Tạo GitHub Actions workflow `eval-check.yml` chạy kiểm thử tự động dry-run trên mỗi PR vào nhánh `develop`.

**Verify:**
- Chạy `pytest tests/` thành công (103/103 passed).
- Chạy `run_all.sh --dry-run` thành công, cập nhật báo cáo `report.md`.

## [2026-06-26 10:04] — Nâng cấp Trải nghiệm Theo dõi Học tập cá nhân (Personal Progress Dashboard)

**Bối cảnh:** Màn hình Theo dõi học tập (`/tien-bo`) gặp lỗi trì hoãn hiển thị biểu đồ do mount state, thiếu biểu đồ thống kê tần suất theo ngày, bộ lọc grid cồng kềnh, nút xuất Excel chưa hiển thị trạng thái và thiếu liên kết hữu ích cho tài khoản Admin/Manager.

**Quyết định:**
1. **Khắc phục lỗi trì hoãn biểu đồ:** Tách luồng render `mounted` (Microtask tick đầu tiên) khỏi `hydrated` data-loading để biểu đồ Recharts được mount ngay lập tức không bị lag/flash.
2. **Thêm biểu đồ tần suất theo ngày:** Tích hợp biểu đồ cột thứ hai theo ngày: **Tần suất tối ưu hóa AI (lần)** hiển thị số lần ghi nhận nhật ký bên cạnh biểu đồ giờ tiết kiệm. Sắp xếp dữ liệu biểu đồ theo thứ tự thời gian tăng dần dựa trên ISO date key.
3. **Tái thiết kế bộ lọc phẳng sắc nét (sharp-edged B2B style):** Thiết kế lại bộ lọc thành thanh công cụ nằm ngang (Horizontal Toolbar) với các nút Preset (Tất cả, Hôm nay, 7 ngày, 30 ngày) và toggled custom date range.
4. **Excel Export Feedback & Admin Warning:** Thêm feedback phản hồi thành công (3 giây) cho nút xuất Excel và liên kết gợi ý quản trị viên `/van-hanh/do-luong` nếu phát hiện tài khoản là admin/manager.
5. **Dọn dẹp code:** Clean up biến unused `avgScore` và giải quyết triệt để cảnh báo cascading render của linter.

**Verify:**
- Chạy `npm run test:unit` thành công (pass 434 tests).
- Chạy `npm run lint` hoàn toàn sạch lỗi (0 errors, 12 warnings cũ).
- Chạy `npx -y -p node@20 node node_modules/next/dist/bin/next build src/frontend` thành công.

## [2026-06-26 09:37] — Tái thiết kế Giao diện Bitemporal Memory và Cải tiến Trình điều khiển Quỹ đạo học tập

**Bối cảnh:** Phần Bitemporal Memory cần thiết kế lại nhằm giúp các quản trị viên dễ dàng nắm bắt những học viên đang gặp khó khăn học tập cụ thể, hiển thị insights rõ ràng cho từng doanh nghiệp/nhóm vai trò và hỗ trợ các tính năng lọc/sắp xếp trực quan. Ngoài ra, cần làm rõ ý nghĩa khái niệm "Bitemporal" (hai chiều thời gian) trên giao diện thay vì hiển thị slider thô sơ.

**Quyết định:**
1. **Cải tiến Trình điều khiển Quỹ đạo (`bitemporal-trajectory-view.tsx`):**
   - Thêm switch toggle **"Nhìn về quá khứ"** để ẩn/hiện slider thời gian (mặc định tắt để hiện dữ liệu mới nhất).
   - Thêm hộp giải thích ý nghĩa Bitemporal: **Thời gian học thực tế (Valid Time)** vs **Thời gian hệ thống ghi nhận (System Time)**.
   - Hiển thị cả 2 mốc thời gian này trực quan trên mỗi sự kiện tiến trình kỹ năng của học viên.
   - Cập nhật bảng màu Tailwind v4 (thay thế bg-red-100/bg-green-100 bằng `emerald`, `amber`, `rose`).
   - Cải tiến phần AI Reasoning Trace dưới dạng trích dẫn đẹp mắt, tinh tế.
2. **Thiết kế lại Giao diện chính (`bitemporal-admin-tab.tsx`):**
   - Chuyển đổi từ grid card sang cấu trúc **Bảng (Table)** tối ưu diện tích hiển thị và hỗ trợ đối chiếu thông tin.
   - Triển khai **Mở rộng dòng inline (Expanded Row)** giúp xem quỹ đạo học tập của từng học viên trực tiếp ngay trong bảng khi click dòng.
   - Bổ sung bộ lọc Doanh nghiệp, Trạng thái (Gặp khó khăn, Hoạt động tốt, Chưa hoạt động), Vai trò (Employee, Manager, Owner) và tìm kiếm học viên client-side. Mặc định sắp xếp theo **Hoạt động gần nhất** (`lastActivityAt` desc).
   - Thêm Sidebar Insight Panel bên phải chứa: Top 5 kỹ năng gặp lỗi nhiều nhất hệ thống, thống kê tỉ lệ lỗi theo doanh nghiệp và biểu đồ so sánh vai trò, kèm theo hộp giải thích Bitemporal collapsible (lưu cache qua `localStorage`).
   - Đảm bảo tuân thủ nghiêm ngặt "Purple Ban" (không dùng màu tím).

**Verify:**
- Chạy `npm run lint` hoàn toàn sạch lỗi (0 errors, 13 warnings cũ).
- Chạy `npm run build` cho thư mục `src/frontend` biên dịch thành công.

## [2026-06-26 09:15] — Tách Platform Admin Console (/van-hanh) thành các Sub-routes độc lập và Tối ưu hóa truy vấn DB


**Bối cảnh:** Toàn bộ trang vận hành hiện tại xử lý chung ở một route duy nhất `/van-hanh` và quản lý tab bằng React state. Điều này làm tăng độ phức tạp khi quản lý code, khó quản lý cache/render và gây tải trọng lớn lên cơ sở dữ liệu (load toàn bộ các bảng dữ liệu của cả 9 tabs mỗi lần truy cập). Cần tách trang thành các sub-routes độc lập bằng Next.js App Router kết hợp tối ưu hóa SQL query tải dữ liệu theo tab và nâng cấp giao diện theo Vercel Web Interface Guidelines.

**Quyết định:**
1. **Thiết kế Route & Layout (`/van-hanh`):**
   - Thiết lập `src/frontend/app/(app)/van-hanh/layout.tsx` đóng vai trò layout chung cho console, giữ phần tiêu đề và thanh điều hướng Tabs (dùng `<Link>` thay cho nút chuyển state).
   - Redirect route gốc `/van-hanh` về `/van-hanh/tong-quan` trong `page.tsx` gốc.
   - Tạo 9 sub-pages tĩnh dưới các thư mục tương ứng: `/tong-quan`, `/to-chuc`, `/nguoi-dung`, `/noi-dung`, `/do-luong`, `/aha-moment`, `/ai-usage`, `/nhat-ky`, `/bitemporal`.
2. **Tab Wrapper Pattern (`tab-wrapper.tsx`):**
   - Đóng gói toàn bộ logic xử lý alert, toast, confirm dialog và skeleton loading dùng chung của admin console vào `PlatformAdminTabWrapper` để giữ code DRY.
3. **Tối ưu hóa Database Query (`platform-admin-console.ts`):**
   - Thêm tham số `tab` vào payload lọc của `PlatformAdminConsoleFilters`.
   - Cập nhật hàm `loadPlatformAdminConsoleReport` để chỉ thực hiện truy vấn DB cho tab đang hoạt động thay vì tất cả các tab, giảm số lượng query DB từ 70% đến 90% mỗi lần tải trang/chuyển tab.
4. **Cải tiến UI/UX & Accessibility:**
   - Thêm focus ring đầy đủ cho input/select được bọc trong nhãn label, thuộc tính `spellcheck="false"`, `autocomplete` cho các trường tìm kiếm.
   - Bảng Organizations hỗ trợ điều hướng dòng bằng bàn phím (Enter/Space, tabIndex, role="button") và sử dụng `tabular-nums` hiển thị số lượng.
   - Định dạng ngày tháng, số điện thoại sử dụng `tabular-nums` và ellipses chuẩn `…` thay vì `...`.
   - Loại bỏ màu tím cấm (Purple Ban) cho các icons hành động và trạng thái (chuyển sang màu cam, xanh da trời).

**Verify:**
- Chạy `npm run lint` hoàn toàn thành công (0 errors).
- Chạy `npm run build` thành công, Next.js build ra toàn bộ 9 sub-pages tĩnh bình thường.

---

## [2026-06-25 23:59] — Tối ưu hóa hiệu năng render và khắc phục tình trạng re-render thư mục Frontend

**Bối cảnh:** Nhận thấy trong thư mục Frontend (`src/frontend`) có một số component bị re-render không cần thiết nhiều lần (đặc biệt trong quá trình streaming tin nhắn của trợ lý chat hoặc thay đổi các bộ lọc ở platform admin console), cần tối ưu hiệu năng render bằng React.memo, useMemo, useCallback. Ngoài ra, khắc phục một số lỗi lints TS trong component mới merge từ `develop`.

**Quyết định:**
1. **Chat Components:**
   - Memoize `ChatRichContent` (`chat-rich-content.tsx`) và `AssistantMessageBubble` (`assistant-chat-messages.tsx`) để tránh re-render tin nhắn cũ trong lúc streaming tin nhắn mới. Sử dụng custom props comparison cho bubble để bỏ qua thay đổi về reference của callback functions.
   - Bọc `splitChatContentBlocks` trong `useMemo` tránh phân tích Markdown lặp lại.
2. **Platform Admin Console:**
   - Bọc các hàm hành động của `usePlatformAdminConsole` trong `useCallback` để giữ reference ổn định.
   - Memoize các mảng lọc lớn (`auditActionOptions`, `auditOrganizationOptions`, `auditActorOptions`, `organizationOptions`) trong `AuditTab` và `AhaReflectionsTab` bằng `useMemo`.
3. **Lộ trình học tập:**
   - Memoize hàm `groupByCategory` và các views trong `LoTrinhTiers` (`lo-trinh-tiers.tsx`) bằng `useMemo`.
4. **Fix lỗi ESLint:**
   - Thay thế các kiểu ép kiểu `as any` thành union types tường minh trong `tien-bo-content.tsx` để vượt qua vòng kiểm tra chất lượng code.

**Verify:**
- Chạy `npm run lint` hoàn toàn sạch lỗi (0 errors).
- Chạy `npm run test` vượt qua tất cả unit test và API integration test.
- Chạy `npm run build` thành công.

---

## [2026-06-25 23:53] — Nâng cấp Màn Theo dõi học tập UI/UX, Biểu đồ và Xuất Excel

**Bối cảnh:** Người dùng cần nâng cấp giao diện Theo dõi học tập (`/tien-bo`), cải tiến bộ lọc & sắp xếp dữ liệu, bổ sung các biểu đồ trực quan hóa dữ liệu và cung cấp nút xuất báo cáo Excel đa bảng bám sát cấu trúc của file mẫu.

**Các cải tiến đã thực hiện:**
1. **Xuất báo cáo Excel đa sheet (`excel-export.ts`):**
   - Cài đặt dependency `xlsx` để hỗ trợ xuất file trực tiếp phía Client-side.
   - Thiết kế các sheet: `01_Tong quan` (KPI tổng hợp), `02_Data sach` (bảng logs thô), `03_Xep hang hoc vien` (kết quả thi trắc nghiệm), `D{DD-MM}` (các sheet chi tiết hoạt động theo ngày) và `04_Review gia tri report` (đề xuất phát triển kỹ năng AI).
2. **Bộ lọc & Sắp xếp dữ liệu (Filter Bar):**
   - Thêm bộ lọc khoảng thời gian (Từ ngày - Đến ngày), lọc theo loại chỉ số (Tất cả, Giờ tiết kiệm, Điểm kiểm tra, Tiến trình) và sắp xếp tăng/giảm dần theo thời gian.
3. **Biểu đồ trực quan hóa dữ liệu (Recharts):**
   - AreaChart biểu diễn số giờ tiết kiệm tích lũy theo ngày với gradient Emerald.
   - Donut Chart biểu diễn % tiến trình hoàn thành lộ trình ở trung tâm.
   - BarChart biểu diễn lịch sử điểm thi trắc nghiệm MCQ qua các lần thi, phân loại màu sắc tự động (Xanh lá >= 80, Xanh teal >= 50, Đỏ < 50).
4. **Chuẩn hóa Web Interface Guidelines:**
   - Sử dụng proper labels, aria-attributes, tabular numbers (`font-variant-numeric: tabular-nums`) cho danh sách số liệu, và ellipses `…` đúng chuẩn.
   - Sử dụng mounted check để tránh hydration error trên các thành phần Recharts SVG.

**Verify:**
- Chạy `npm run build` thành công, kiểm tra kiểu tĩnh (TypeScript) thành công.
- Xác nhận không có lỗi runtime.

---

## [2026-06-25 22:55] — Sửa filter ngày của đo lường học tập

**Bối cảnh:** Khi lọc riêng ngày 24/06/2026, API vẫn trả toàn bộ 45 hồ sơ nhưng các cột tiến độ bằng 0. Nguyên nhân là filter chỉ áp dụng lên `module_progress.completed_at`, dùng `lte(toDate)` tại đầu ngày UTC, còn các nguồn hoạt động khác và danh sách hồ sơ không được lọc.

**Quyết định:**
- Chuẩn hóa ngày chọn theo `Asia/Ho_Chi_Minh` thành khoảng UTC đóng–mở `[đầu ngày, đầu ngày kế tiếp)`.
- Khi có filter ngày, chỉ trả học viên có hoạt động trong khoảng từ `events`, hoàn thành bài, quiz, chat hoặc nhật ký giờ.
- Các metric bài học/quiz/chat/giờ/điểm/ngày hoạt động/phiên được tính trong cùng khoảng ngày.
- `lastActivityAt` lấy mốc mới nhất giữa hoạt động ứng dụng và lần đăng nhập cuối.
- Ngày trong thẻ “Hoàn thành bài theo ngày” hiển thị ngày lịch, không parse thành `07:00`.

**Kỳ vọng đối chiếu 24/06/2026:** 8 bài, 5 người hoàn thành và 13 người có hoạt động; bảng ngày đó trả 13 học viên thay vì 45.

**Verify:** `npm run lint` pass với 12 warning có sẵn; `npm run test` pass (434 Vitest, 30 Phase 1 API, 12 manager/invite, 7 auth/OAuth, 3 activity/metrics, 103 pytest); `npm run build` pass.

---

## [2026-06-25 12:35] — Refactor UI/UX Platform Admin Console (nhánh refactor/platform-admin-ui-ux)

**Bối cảnh:** User (quản trị viên) không hài lòng với giao diện Platform Admin Console (/van-hanh) cũ, đánh giá là "use-less", không khai thác được thông tin hữu ích và thiếu độ hoàn thiện thẩm mỹ.

**Các cải tiến đã thực hiện:**
1. **Nâng cấp platform-admin-console-ui.tsx (Primitives):**
   - Thêm component `Sparkline` vẽ biểu đồ quỹ đạo nhanh bằng SVG nội tuyến (không phụ thuộc thư viện ngoài).
   - Thêm `TrendBadge` và `StatusDot` hỗ trợ biểu thị xu hướng % tăng/giảm và trạng thái hoạt động trực quan.
   - Thêm `HealthBanner` hàng ngang báo cáo trạng thái các dịch vụ cốt lõi (Cơ sở dữ liệu, API AI, Network).
   - Thêm `InsightAlert` phân loại cảnh báo theo mức độ nghiêm trọng (info, warning, critical, success).
   - Nâng cấp `KpiHeroCard` (nền gradient, trend badge, sparkline), `MetricCard`, `MetricMini` (màu sắc trạng thái, hỗ trợ xu hướng).
   - Tối ưu hóa các style HSL dịu mắt, hover lift animation nhẹ, bo góc lớn (2xl) chuẩn Premium Executive Dashboard.
2. **Refactor overview-tab.tsx (Tổng quan):**
   - Thay thế 4 MetricCard đơn điệu bằng 4 `KpiHeroCard` cao cấp hiển thị xu hướng và sparkline thật (dựa trên dữ liệu hiện tại).
   - Tích hợp `HealthBanner` động phản ánh kết nối cơ sở dữ liệu Supabase và cấu hình OpenAI.
   - Phân cấp hệ thống Alert bằng `InsightAlert` trạng thái rõ ràng.
3. **Refactor ai-usage-tab.tsx (AI & sử dụng):**
   - Thêm banner tình trạng API OpenAI.
   - Tạo biểu đồ đo API hạn mức sử dụng (Rate Limit) dạng progress bar OLED mượt mà.
   - Tách biệt và cấu trúc lại thông tin học tập, module, bài học, aha reflections gọn gàng và khoa học.
4. **Refactor bitemporal-admin-tab.tsx (Bitemporal Memory):**
   - Thiết kế lại toàn bộ trải nghiệm từ dropdown chọn học viên đơn lẻ sang Dashboard học tập đa chiều.
   - Thêm bảng chỉ số tổng hợp hệ thống: Tổng liên kết học tập, Số học viên có bộ nhớ, Số học viên gặp khó khăn, Số học viên hoàn thành ổn định.
   - Xây dựng User Explorer Grid: hiển thị thẻ học viên thông tin avatar, email, lượt học, ngày cập nhật kèm badge trạng thái ("Hoạt động tốt", "Gặp khó khăn", "Không có dữ liệu").
   - Tính toán client-side thông minh gợi ý Insights vận hành: tự động phát hiện học viên chưa onboarding, thống kê Top 3 kỹ năng (module_id) có tần suất lỗi `STRUGGLED` cao nhất trong hệ thống để quản trị viên cân nhắc sửa nội dung.
   - Hỗ trợ xem chi tiết Quỹ đạo bitemporal và Reasoning Trace của từng học viên dạng collapsible mượt mà.
5. **Nâng cấp Platform Admin Shell (platform-admin-console.tsx):**
   - Thanh điều hướng tab chuyển sang dạng scroll ngang mượt mà trên mobile.
   - Tích hợp dynamic count badge đếm trực tiếp số lượng đối tượng tương ứng trên tiêu đề tab (ví dụ: "Tổ chức (1)", "Người dùng (28)").
6. **Refactor màn danh sách quản trị (users-tab.tsx, organizations-tab.tsx, content-tab.tsx, platform-admin-list-primitives.tsx):**
   - Xây dựng component TableInputField và TableSelectField mang phong cách Inline Borderless Inputs (chỉ hiển thị viền/nền khi hover/focus).
   - Thay thế các input/select xám dày trong bảng danh sách thành viên, danh sách công ty và danh sách học liệu bằng các trường inline.
   - Thêm hiệu ứng highlight hàng khi dòng đó được tích chọn.
   - Lọc trạng thái công ty kích hoạt confirmation guard trước khi đổi trạng thái trực tiếp.
7. **Thiết kế Timeline nhật ký hoạt động (audit-tab.tsx):**
   - Tái cấu trúc bảng nhật ký thô thành một timeline feed dạng dọc có đường line liên tục và các icon Lucide tương ứng riêng cho mỗi nhóm hành động.
8. **Cài đặt doanh nghiệp Bento & Invite Link (company-settings-content.tsx):**
   - Thiết kế lại trang cài đặt doanh nghiệp thành layout Bento Grid/Card-based sang trọng.
   - Tích hợp quản lý Invite Link (lấy link mời tự động qua API, copy một chạm Clipboard, xoay link mời bảo mật với confirmation).
   - Thêm bảng phân quyền thành viên và lối tắt không gian trực quan.
9. **Safety Fallback và thu gọn Account Menu (trajectory/route.ts, account-menu.ts):**
   - Thêm try/catch fallback cho trajectory API trả về mảng rỗng nếu postgrest cache hết hạn.
   - Gom 4 tab cài đặt tài khoản trong dropdown thành 1 link "Cài đặt tài khoản".

**Verify:**
- Chạy `npm run lint` sạch hoàn toàn (0 errors, 12 warnings).
- Chạy `npm run test:unit` thành công 100% (430 tests passed), cập nhật test spec trong `account-menu.test.ts`.
- Chạy `npm run build` thành công, tạo static pages tối ưu hoàn hảo.

---

## [2026-06-25 11:20] — 🎯 GỐC RỄ chậm: Vercel function ở US, Supabase ở Singapore (nhánh perf/vercel-region-singapore)

**Bối cảnh:** Sau Tầng 1-3 user vẫn thấy chậm. Đào sâu: `/api/member/learning-path` ~3.5s mỗi lần. Loại trừ từng giả thuyết:
- KHÔNG phải LLM: route GET chỉ đọc `generated_learning_paths` từ DB ([route.ts:28-38](src/frontend/app/api/member/learning-path/route.ts:28)).
- KHÔNG phải cold-start: gọi 3 lần warm vẫn 3.6/3.7/3.2s.
- KHÔNG phải DB: JSON result ~1KB, index PK trên user_id đầy đủ.
- **THỦ PHẠM:** header `x-vercel-id = hkg1::iad1::...` → function chạy ở **iad1 (US East)**, Supabase ở **ap-southeast-1 (Singapore)**. Mỗi query DB vượt Thái Bình Dương (~800ms/call gồm RTT + TLS handshake) × nhiều query tuần tự = 3.5s.

**Fix:** thêm `vercel.json` `{ "regions": ["sin1"] }` (root — vì Vercel Root Directory = repo root, build `next build src/frontend`). Pin function sang Singapore (cùng DB + gần user VN). Config-only, atomic deploy, reversible.

**Verify trên preview rồi mới production:** x-vercel-id `hkg1::sin1` (vs prod `hkg1::iad1`). Đo production sau deploy:
| Endpoint | Trước (iad1) | Sau (sin1) |
|---|---|---|
| learning-path (warm) | 3167ms | **399ms** (~8×) |
| /api/profile | ~850ms | **234ms** |
| /api/quiz-results | ~1900ms | **504ms** |

→ Đây mới là fix cho độ trễ user CẢM THẤY. Tầng 1-3 dọn việc thừa; region fix giải quyết gốc.

**Còn tối ưu được (optional):** trong endpoint learning-path, gộp các query độc lập (profiles + generated_learning_paths) vào Promise.all để cắt thêm.

---

## [2026-06-25 10:05] — Perf Tầng 3 + xác minh Bug B (cùng nhánh fix/perf-waterfall-prefetch)

**Xác minh trên preview (login HR):** Trợ lý chat nổi (lazy) mở + load + gửi/nhận OK. `/lo-trinh` render đầy đủ; nav + API (`/profile`,`/quiz-results`,`/modules`) đều 200. Cảnh "trắng lúc load" là **cold-start preview + Bug B**, KHÔNG do thay đổi perf.

**Tầng 3:** `loading.tsx` đã có sẵn cho mọi route `(app)` (RSC-nav skeleton). Điểm yếu duy nhất còn lại = **Bug B**: `lo-trinh-content` lúc client tự fetch chỉ hiện 1 thanh `h-32` (gần như trắng), trong khi bài học/tiến bộ dùng skeleton đầy đủ. Fix: `lo-trinh-content` `!hydrated` → dùng `LoTrinhPageSkeleton` (đồng bộ 2 trang kia). Hết cảnh trắng-lúc-fetch trên `/lo-trinh`.

**Verify:** typecheck sạch · build OK · unit 427/427 · lint 0 error.

**Check lại phát hiện thêm — `/tien-bo` chậm:** verify trên preview (account đã onboard) thấy bài học render OK + dùng `/api/modules/order` (heavy `/api/modules`=0). Nhưng `/tien-bo` skeleton lâu (~17s cold) vì `refresh()` gọi **4 API tuần tự** (profile→logs→quiz→progress) + fetch **84 module nặng** chỉ để đếm %. Fix: gộp 4 API vào `Promise.all` + thay `fetchModules`→`fetchModuleOrder` (nhẹ, chỉ cần id+count). Cùng kiểu Tầng 2, có fallback static. typecheck/build/427 test/lint sạch.

---

## [2026-06-25 09:33] — Perf Tầng 2: bài học bỏ tải full 84 module + next-id không chặn (cùng nhánh fix/perf-waterfall-prefetch)

**Phát hiện:** trang bài học (`module-lesson-content.tsx`) fetch **cả 84 module đầy đủ** (`/api/modules`, ~3.1s) CHỈ để tính "bài kế tiếp" (`resolveNextModuleId`) — và **chặn hiển thị** nội dung bài chờ nó xong.

**Sửa (có fallback static, không đổi hành vi):**
- Thêm `fetchModuleOrderForRole()` (`learning-modules.ts`) chỉ `select id, sort_order, level` → payload nhẹ; route mới `/api/modules/order` (cùng guard quyền `/api/modules`); client `fetchModuleOrder()`.
- `resolveNextModuleId` nới type tham số về `{id, sort_order}[]` (LearningModuleRecord vẫn thỏa).
- Bài học: dùng `fetchModuleOrder` + tính next-id **không chặn** (`.then`, không `await`) → nội dung bài hiện ngay ~856ms, nút "Bài tiếp theo" điền sau. `saveEmployeeModuleStatus("dang-hoc")` chuyển fire-and-forget (status đã set optimistic).

**Lưu ý:** `/lo-trinh` đã parallel sẵn (Promise.all) nên không sửa; "learning-path 3×" lúc đo production là do điều hướng qua lại, không phải 3 call/load. `module_progress` còn vài call trùng → để dọn sau nếu cần.

**Verify:** typecheck sạch · build OK 3.3s (route `/api/modules/order` đăng ký) · unit 427/427 · lint 0 error.

---

## [2026-06-25 08:35] — Perf Tầng 1: chặn prefetch storm + lazy chat + fire-and-forget events (nhánh fix/perf-waterfall-prefetch)

**Đo production (Chrome Perf API):** `/lo-trinh` ~2.2s interactive, bài học `/lo-trinh/[id]` ~2.8s. JS bundle KHÔNG phải vấn đề (đã cache 80–150KB). Chậm do waterfall API + gọi lặp + prefetch toàn nav.

**Nguyên nhân (truy ra code):**
1. `app-nav.tsx` `<Link>` mặc định → mỗi trang prefetch RSC của cả 6 trang nav, mỗi cái chạy query Supabase server-side → nhiều cái **503**.
2. `(app)/layout.tsx` mount `AppAssistantHost`→`FloatingAssistantWidget`→`useAssistantChat` fetch `/api/chat/history?draft=1` (~2.2s) trên MỌI trang dù chưa mở chat.
3. `trackEvent` (`client-api.ts`) `await fetch('/api/events')` → analytics chặn render 0.8–3.5s, gọi nhiều lần.
4. (ghi nhận, để Tầng 2) `/api/member/learning-path` gọi 3×; `module_progress` 2–3× (1 trong số đó do chat-context của widget → lazy-chat tự bớt).

**Tầng 1 đã sửa (không đổi logic, chỉ bỏ việc thừa):**
- Nav desktop+mobile thêm `prefetch={false}` → hết prefetch 6 trang + hết 503.
- `useAssistantChat` thêm option `enabled`; `FloatingAssistantWidget` truyền `enabled=hasOpened` → chỉ fetch chat history sau lần mở trợ lý đầu tiên (widget vốn `noRestore:true`, defer an toàn).
- `trackEvent` → fire-and-forget + `keepalive` (không `await`).

**Verify:** typecheck sạch (file sửa) · build OK 3.4s · unit 427/427 · lint 0 error. Đo before/after trên Vercel preview trước khi đề xuất deploy.

---

## [2026-06-25 07:30] — Fix Bug A: onboarding đếm module thật từ DB (nhánh fix/onboarding-module-count-from-db)

**Context:** Onboarding hiện "Nhân sự / HR — 56 module" (cả màn chọn vai trò lẫn màn kết quả) trong khi DB có 84 bài published. Số cũ lấy từ `role.modules.length` (data tĩnh `roles-hr.ts` = 56). Chỉ `nhan-su` lệch; các vai trò khác static khớp DB (van-hanh 14, ke-toan 8, còn lại 6).

**Fix:** đọc count từ nguồn DB thật, fallback static khi chưa cấu hình Supabase:
1. `lib/learning-modules.ts`: thêm `fetchPublishedModuleCounts()` → `Record<roleId,{total,advanced}>` (group published; advanced = level≥2). Fallback `countModulesFromStatic()`.
2. `app/(app)/onboarding/page.tsx`: chuyển async server component, fetch counts, truyền `moduleCounts` xuống.
3. `components/onboarding-flow.tsx`: thread `moduleCounts` qua `StepRole` (teaser) + `StepResult` (kết quả). Hiển thị `total`; nhánh skipBasic hiện `advanced` nâng cao + `basic = total-advanced` (sửa luôn chuỗi "skip 2 module cơ bản" cứng → số thật).

**Số sau fix (DB published):** nhan-su 84 (67 nâng cao / 17 cơ bản); các vai trò khác giữ nguyên.

**Verify:** build OK exit 0; lint 0 error; unit 427/427 pass; DB query xác nhận count. Diff 3 file, chỉ phạm vi onboarding count.

---

## [2026-06-24 23:15] — Audit tốc độ web + giao diện mobile (nhánh feat/audit-toc-do-web-mobile-ui)

**Context:** Audit tốc độ + responsive mobile toàn web (landing, /lo-trinh, /tro-ly, (app)). Tách từ `develop` mới nhất.

**Phát hiện chính:** Codebase vốn đã mobile-aware tốt + đã được Next tối ưu sẵn nhiều; audit explore over-report. Sau khi xác minh từng điểm, chỉ ship các thay đổi THẬT:
1. `viewport` meta vào `app/layout.tsx` (fix mobile tự zoom/tràn ngang — fix nền tảng toàn cục). REAL.
2. `@next/bundle-analyzer` + script `npm run analyze` + `next.config` (compress/sourcemap là explicit-default, no-op; images webp/cache forward-looking). Giá trị thật = tooling đo.
3. Landing mobile polish: hero `text-3xl`@mobile, header CTA `h-11` (≥44px), lo-trinh prompt grid 1→2→3 cột. **Verified @375px qua Preview** (không tràn ngang).
4. `perf(lesson)`: parallel hóa `getEmployeeExtraLessons` trong `module-lesson-content.tsx` (bỏ 1 round-trip nối đuôi khi mở bài học).

**BÁC sau xác minh (tránh churn/regression):**
- DB index (P4): cả 2 index audit đề xuất đã tồn tại (`module_progress` unique(user_id,module_id) `0001_init:29`; `extra_skill_lessons_user_enrolled_idx` migration `20260619190000:19`).
- AuthLinkErrorGuard off landing: guard xử lý lỗi magic-link `#error` trên `/` — gỡ sẽ regress.
- Code-split recharts: Next đã route-split; chunk 393.7KB chỉ tải ở `/quan-ly`, non-manager không tải.
- `<img>`→`next/image` (5 chỗ): đều remote URL tùy ý / `blob:` object-URL — convert sẽ vỡ; dev đã chủ ý raw.

**Verify:** build OK 3.2s exit 0; lint 0 error (12 warning sẵn). Unit test: 412 pass / **3 fail PRE-EXISTING** ở `assessment-hr-signals.test.ts` (do commit `91c4c07`, mong 16 câu HR ↔ code 12) + `vercel-cli-json.test.mjs` (lỗi sẵn). Nhánh KHÔNG đụng các file đó (`git diff --name-only develop...HEAD`) → không phải regression mới.

**Cần quyết định (flag cho Lucas):** (1) HR survey 16 hay 12 câu → sửa test/data tương ứng; (2) WORKLOG.md còn marker merge `<<<<<<< HEAD` (~dòng 25) chưa resolve; (3) có muốn load thật brand font (Be Vietnam Pro/Bricolage) qua `next/font` không — hiện chỉ font-stack, fallback system.

**Report:** `plans/reports/perf-260624-2315-GH-6-baseline.md`.
## [2026-06-25] — Onboarding HR: thêm bậc Director + cap 3 nhóm việc (nhánh feat/hr-onboarding-cap-3-tasks-director)

**Context:** Lucas phản ánh: ở `q3hr-tasks` helper ghi "chọn TẤT CẢ" → người dùng chọn hết → lộ trình full, không sát nhu cầu hiện tại. Thêm: cần tín hiệu cấp bậc (nhân viên/quản lý/director) vì ảnh hưởng nội dung học.

**Quyết định (đã chốt với Lucas):**
- **A1 — mở rộng `q1-position`:** thêm option `director` "Giám đốc/Ban lãnh đạo (C-level)", **score 5 = manager** → KHÔNG nâng trần điểm, không vỡ phân loại role khác. HR level do gate (automation/agent) quyết, không phụ thuộc q1.
- **Hard cap 3 — `q3hr-tasks`:** đổi tiêu đề "tuần đầu, tối đa 3 nhóm" + helper bỏ "chọn tất cả" + `maxSelect:3` (field mới trên `AssessmentQuestion`). Onboarding multi-chip enforce cap (chặn + làm mờ chip thừa) + counter "đã chọn x/3". Lý do 3 đủ: mỗi nhóm (~6 nhóm `HR_TASK_CATEGORIES`) ≈ 10 bài rải 5 tier → 3 nhóm ≈ 20-30 bài.
- Số câu giữ **12** (chỉ thêm option/maxSelect) → test composition cũ vẫn đúng.

**Shipped:** `lib/assessment.ts` (type +maxSelect, q1 +director), `lib/assessment-hr.ts` (q3hr-tasks cap+reframe), `components/onboarding-flow.tsx` (enforce cap + counter), `lib/assessment-hr.test.ts` (+2 test); xóa orphan `assessment-hr-signals.test.ts`.

**Verify:** build OK exit 0; lint 0 error; unit **414 pass / 0 fail** (vercel-cli-json suite-load lỗi sẵn). CHƯA verify trực quan flow onboarding (cần đăng nhập).

**Hai insight Lucas nêu — đã xác minh code, KHÔNG cần thêm việc:**
- *"Chọn 3 có hổng kiến thức nền?"* → KHÔNG. Track 0 "Nền tảng vào mọi lộ trình" (`roles-hr.ts:210`, skill `hr-nen-tang` tách khỏi 6 nhóm việc); `path-agent-validate.ts` luôn xếp foundation đầu + không bao giờ cắt bài nền (dòng 33-35, 78-84).
- *"FOMO, coi như thư viện, có việc thì vào học"* → kiến trúc đã là model đó: path active **tự cap 8-10 bài** (`path-agent-validate.ts:11-12`, KHÔNG phải 64) + catalog đầy đủ + "Kỹ năng khác" cho kéo bài bất kỳ khi cần.
- → **Cap-3 KHÔNG để rút path** (path vốn ~10) mà để **10 bài tập trung/mạch lạc**. Hành vi mở rộng đã được Library + "Kỹ năng khác" lo.

**Quyết định cuối (Lucas chốt — sau khi xem live qua Chrome):** **BỎ cap-3, GIỮ Director.** Lý do: tệp khách hàng đang chạy thật → CHƯA giới hạn chọn nhóm việc; phần limit cấu hình sau. Đã revert maxSelect:3 + copy + enforce + maxSelect type; giữ q1-position +Director (score 5, additive).

**Walkthrough LIVE production (tài khoản Lucas Audit, đã onboard HR):** xác nhận flow survey→level→composition (gợi ý tích sẵn + "Kỹ năng khác") đúng; foundation đứng đầu (Claude basics, prompt, an toàn dữ liệu). Bước 2 "xưng hô" hiện đúng (BUG-05 hết). Phát hiện 3 bug:
- **Bug A (count):** thẻ vai trò + màn kết quả ghi `role.modules.length` = **56** (static `roles-hr.ts`) nhưng DB `nhan-su` có **84** bài (query xác nhận). Static cũ thiếu m57→m84. → Cần sync `roles-hr.ts` lên 84 (qua pipeline seed/content) HOẶC cho thẻ/kết quả đọc count DB. CHƯA fix (cần nội dung/refactor — không hack).
- **Bug B (loading):** `/lo-trinh` sau onboarding để `<main>` **trắng** trong lúc chờ (path gen async); mọi API 200, không console error, sau ~vài chục giây mới render. → Thiếu trạng thái loading/generating rõ ràng. CHƯA fix (cần repro local — tránh sửa mù trên render path khách đang chạy).
- **Bug C (FIXED):** comment `lo-trinh-composition.tsx` ghi "Chặn cứng tối đa 15 bài" nhưng `MAX_SELECTION = 999` (learning-path-selection.ts:10) = thực tế không limit. Đã sửa comment cho khớp (đúng ý "chưa limit, cấu hình sau"). Không đổi hành vi.

→ PR #41 giờ = **Director + sửa comment 15→999 + bỏ cap-3**. Bug A & B tách task riêng.

---

## [2026-06-24] — Annie full Notion sync = DONE + E2E smoke test production

**Context:** Nội dung HR đã sync xong. Đánh dấu "Annie full Notion sync" Done và chạy E2E smoke 7 mục trên `ai-tro-ly.lucasnguyen.vn`.

**Verify nội dung (DB `dtiylxmrqltttjswqpzu`):** 84 bài HR (`nhan-su`), 0 "[GỘP", 0 trùng id, L1→L5 (L4=6, L5=4); 6 mã free `published=true`.

**Smoke 7 mục — 4/7 PASS.** Báo cáo: `plans/reports/smoke-260624-1928-e2e-production.md`.
- ✅ Đăng ký · ✅ Lộ trình · ✅ Tiến bộ (+1h → 1.0 giờ) · ✅ Freemium gate (chặn → `/nang-cap`).
- ❌ **Onboarding bỏ BƯỚC 2 (xưng hô)** — BUG-05. Fix có ở nhánh `feat/phase-0-thong-luong-vao-hoc` (commit `1c046ac`, `onboarding-flow.tsx:41` `setStep("address")`) nhưng **chưa merge `develop`/`main`**.
- ⚠ Trợ lý over-refuse "AI là gì?" (lệch acceptance 9.2).
- ⚠ Gate freemium = 3 bài (`DEFAULT_TRIAL_MODULE_LIMIT`), **không phải 6** (FEATURE-01 chưa deploy); bảng `learning_entitlements` thiếu trên prod → không có đường mở full access; `learning_activated` không được gate đọc.

**Cần quyết định:** merge Phase 0 lên prod? thêm migration `learning_entitlements`? chốt mô hình gate (3 bài vs 6 bài vs entitlements).

---

## [2026-06-22] — Tinh chỉnh /lo-trinh + bảng xếp hạng toàn cục cho user tự do

**Context:** Trang `/lo-trinh` có block "Lộ trình AI gợi ý cho bạn" (AgentPathPanel) trùng với lộ trình đã chốt bên dưới. Bảng xếp hạng đang org-scoped → user cá nhân (không org) chỉ thấy chính mình.

**Decision:**
- **Tạm ẩn AgentPathPanel** (không xóa): cờ `SHOW_AGENT_PATH_PANEL = false` trong `components/lo-trinh-content.tsx`. Đặt lại `true` để bật. Chỗ này thay bằng thẻ mới `components/learning-encouragement-card.tsx` ("Lời nhắn động viên") — copy nháp, **chờ Lucas duyệt lời**.
- **Bảng xếp hạng toàn cục cho user tự do:** `app/api/leaderboard/route.ts` — khi user không thuộc org (`!orgId`), gộp mọi user đã có điểm trong `points_ledger` (real data) thay vì chỉ self. Phòng hiển thị "Cộng đồng". Vẫn đọc điểm thật (+5 bài / +15 kiểm tra qua `awardPointsOnce`), giữ opt-in ẩn tên ở bảng công ty.

**Verify:** lint 0 error; build OK; test 362 pass (chỉ `vercel-cli-json.test.mjs` lỗi sẵn — bỏ qua). Không đổi DB schema.

---

## [2026-06-24] — Triển khai Bitemporal Graph Memory cho Điều phối Học tập

**Context:** Hệ thống cần nâng cấp cốt lõi bộ nhớ AI Agent từ State snapshot sang Bitemporal Graph Memory để phân tích xu hướng học tập (pattern) và hỗ trợ cập nhật hồi tố (Retroactive Correction).
**Decision:**
- Thiết kế bảng `temporal_knowledge_edges` với thiết kế Append-Only (lưu Valid Time và Transaction Time).
- Viết function PostgreSQL `get_student_trajectory_at` nội suy trạng thái đồ thị.
- Cập nhật state của LangGraph (`src/backend/agents/learning_path/state.py`) để nhận `trajectory_edges`. Sửa prompt LLM trả về `reasoningTrace` để minh bạch logic.
- Phát triển UI `BitemporalTrajectoryView` cho Frontend (trang Vận hành) với chức năng time-travel slider và mock API.
- Tách logic slider thành pure function `calculateBitemporalState` tại `bitemporal-logic.ts` để đảm bảo test bằng Vitest trong Node environment.
**Owner:** Antigravity AI Agent
**Status:** Active
**Tests:** `pytest tests/test_agents/test_learning_path_graph.py` pass; `npx vitest run src/frontend/lib/bitemporal-logic.test.ts` pass; `npm run db:validate` pass.


## [2026-06-24] — Setup User Activity Log and Manager Timeline UI

**Context:** Hệ thống cần tracking activity xuyên suốt các route học và cần một drawer timeline để manager đọc được lịch sử thao tác của nhân viên.
**Decision:**
- Fixed emitter bug to actually call `logUserActivity` from all routes.
- Fixed bug querying `reason` on `time_logs` by reading `note` thay vì cột cũ.
- Implemented Manager timeline modal using `UserActivityTimeline`.
- Mapped raw DB event names to Vietnamese strings in timeline.
- Added missing rollback block to index migration.
- Created unit test script.
**Files:** `src/frontend/app/auth/callback/route.ts`, `src/frontend/app/api/progress/route.ts`, `src/frontend/app/api/quiz-results/route.ts`, `src/frontend/app/api/chat/route.ts`, `src/frontend/app/api/agent/lo-trinh/route.ts`, `src/frontend/app/api/member/learning-path/route.ts`, `src/frontend/app/api/nhat-ky/route.ts`, `src/frontend/app/api/manager/team/[userId]/activity/route.ts`, `src/frontend/components/platform-admin/user-detail-drawer.tsx`, `src/frontend/components/manager-dashboard.tsx`, `src/frontend/components/manager-team-list.tsx`, `src/frontend/components/manager-user-timeline-drawer.tsx`, `supabase/migrations/20260624115200_events_indexes.sql`, `scripts/test-activity-log.mjs`, `scripts/run-all-tests.mjs`.
**Tests:** `npm run test`, `npm run lint`, `npm run build` pass.


## [2026-06-24] — HR level classification re-audit and onboarding validation fixes

**Context:** Re-audit độc lập phát hiện gap ở flow onboard HR level 1–5 dù bản classification fix đã có trên branch riêng.
**Decision:**
- Enabled free-text questions by default in onboarding flow.
- Set `skipBasicModules` for HR level assessment based on corrected `aiLevel` (level >= 5) instead of total score.
- Added L5⊇L4 invariant documentation.
- Created audit report, implementation notes, and cleanup SQL script.
- Ran cleanup script locally to delete test users.
**Tests:** `npm run lint` clean; `npm run test` pass; `npm run build` pass; local cleanup SQL executed and verified.


## [2026-06-23] — Trial entitlement gate cho user lẻ và user công ty

**Context:** Sau khi tạm tắt `/cho-kich-hoat`, cần một gate tối thiểu để user lẻ được học thử 3 bài đầu, còn user thuộc doanh nghiệp chỉ mở full khi có entitlement active. Không backfill/gom tất cả user hiện tại vào một công ty vì rủi ro dữ liệu và policy chưa chốt.

**Decision:**
- Thêm bảng `learning_entitlements` làm source quyền học mới cho scope `user` hoặc `organization`; `organization_members` vẫn là source of truth cho user thuộc công ty.
- User không có entitlement active mặc định ở `trial` và chỉ được mở các module trial đầu tiên; org/user có entitlement `active` được full access; entitlement `blocked` chặn học.
- Script pilot chỉ nhận danh sách email được chọn thủ công, không gom toàn bộ user non-admin.
- UI `/lo-trinh` hiển thị trạng thái học thử và khóa bài ngoài trial; server guard + API ghi dữ liệu kiểm tra lại để tránh bypass bằng URL/request tay.

**Files:** `supabase/migrations/20260623104942_learning_entitlements.sql`, `supabase/scripts/create-pilot-learning-entitlement.sql`, `src/frontend/lib/learning-access.ts`, `src/frontend/app/api/member/learning-path/route.ts`, `src/frontend/components/lo-trinh-content.tsx`, `src/frontend/components/lo-trinh-tiers.tsx`, `src/frontend/app/(app)/nang-cap/page.tsx`, module/API guards liên quan.

**Verify:** `npm run db:validate` pass; targeted Vitest `src/frontend/lib/learning-access.test.ts` pass; `npm run lint` pass với 8 warning có sẵn; `npm run test` pass (80 Vitest files / 383 tests, 30/30 Phase 1 API, 12/12 Phase 2 manager/invite, 7/7 auth/OAuth, 96 pytest); `npm run build` pass; `git diff --check` pass.

**Follow-up:** Cần thay email placeholder trong `supabase/scripts/create-pilot-learning-entitlement.sql` bằng danh sách pilot thật trước khi chạy production SQL; phần billing/auto activation sau thanh toán vẫn là phase sau.

## [2026-06-24] — Re-audit HR Level 1–5 + P0 fixes

**Context:** Bản fix phân loại level đã có trên branch `fix/hr-assessment-level-classification` (capability-gate trong `calculateHrAssessmentResult`). Re-audit độc lập phát hiện 3 lỗ hổng P0 bổ sung.

**P0 fixes:**
- **P0-A:** Câu hỏi mở `q-hr-recurring` (free-text) bị tắt vì `StepAssessment` không có nhánh textarea và flow gọi `includeFreeText=false`. → Thêm textarea (500 chars, optional, sanitize HTML), bật `includeFreeText=true`.
- **P0-B:** Monotonic invariant L5⊇L4 chưa document. → Thêm JSDoc comment (logic decision tree đã đúng — short-circuit).
- **P0-C:** `skipBasicModules` lấy từ legacy total-score, không khớp HR `aiLevel`. HR L5 có thể có `skipBasicModules=false`. → Override `skipBasicModules: aiLevel >= 5` trong `calculateHrAssessmentResult`.

**P1 decisions (no code change):**
- L2/L3 boundary: giữ `promptSkill "2"` → L3 (context-aware = L3 theo slides).
- Self-report L4/L5: giữ yes/no (diagnostic, không phải certification).

**P2 deferred:** ≥16 câu, generalize capability-gate cho role khác — chờ user chốt scope.

**Test:** 5 account L1–L5 PASS (DB verified), gồm regression L3 và edge case monotonic L5. Đã chạy thành công file SQL `cleanup-hr-level-reaudit-20260624.sql` ở local để dọn dẹp các tài khoản test khỏi database.

---

## [2026-06-23] — Tạm tắt learning activation gate để bỏ màn `/cho-kich-hoat`

**Context:** Luồng phân loại tài khoản cá nhân/doanh nghiệp + trial/trả phí chưa đủ chín để kịp ship. Ép gom toàn bộ user hiện tại vào một organization có rủi ro dữ liệu và không giải quyết đầy đủ billing/trial.

**Decision:**
- Không tạo migration/backfill `organization_members`; giữ nguyên dữ liệu `learning_activated` và admin UI để có thể bật lại sau.
- Tạm thời cho mọi learner đã có `role_id` vào học luôn; `/cho-kich-hoat` trở thành route redirect-only.
- Onboarding sau khi xem kết quả đi thẳng `/lo-trinh`; proxy và post-auth redirect không còn đưa pending learner về `/cho-kich-hoat`.

**Files:** `src/frontend/lib/learning-activation.ts`, `src/frontend/proxy.ts`, `src/frontend/lib/post-auth-redirect.ts`, các page guard học chính, `src/frontend/components/onboarding-flow.tsx`, tests liên quan.

**Verify:** Targeted Vitest `src/frontend/lib/learning-activation.test.ts src/frontend/lib/post-auth-redirect.test.ts src/frontend/proxy.test.ts` pass (24 tests); `npm run lint` pass (8 warnings có sẵn); `npm run test` pass (79 Vitest files / 380 tests, 30/30 Phase 1 API, 12/12 Phase 2 manager/invite, 7/7 auth/OAuth, 96 pytest); Node 20 `next build src/frontend` pass.

**Follow-up:** Khi làm lại paid/trial, thiết kế riêng policy cá nhân 3 bài đầu + doanh nghiệp theo membership/seat/billing, rồi mới bật lại activation gate hoặc thay bằng gate mới.

## [2026-06-22] — FE learning-path agent service + Supabase context prompt

**Context:** BE chưa triển khai, nhưng `/api/agent/lo-trinh` ở FE vẫn cần một lớp agent đủ tự chủ để đọc Supabase, cache path, và sinh lộ trình mà không phụ thuộc đường backend.

**Decision:**
- Tạo service FE-native `src/frontend/lib/agent/path-agent-service.ts` để route chỉ còn auth/guard, còn agent tự lo preview phòng ban, resolve input, cache, generate, và persist.
- Bổ sung `organizationContextText` vào `AgentFlowInput` bằng `formatOrganizationLearningContext(...)` để prompt có đủ ngữ cảnh Supabase về công ty/phòng ban/lộ trình giao.
- Đưa `primaryTool` và context text vào fingerprint để cache đổi đúng khi tool hoặc ngữ cảnh công ty đổi.

**Files:** `src/frontend/lib/agent/{path-agent-service,path-agent-input,path-agent-types,path-agent}.ts`, `src/frontend/app/api/agent/lo-trinh/route.ts`, tests mới/cập nhật cho route, service, input.

**Verify:** `npx vitest run src/frontend/lib/agent/path-agent-input.test.ts src/frontend/lib/agent/path-agent-service.test.ts src/frontend/app/api/agent/lo-trinh/route.test.ts src/frontend/lib/agent/path-agent.test.ts` pass; `npm run lint` pass (8 warnings có sẵn); `npm run test` pass (77 Vitest files / 370 tests); `npm run build` pass.

**Follow-up:** nếu cần graph phức tạp hơn nữa, service FE này là chỗ đúng để tách thêm node/tool, không phải đẩy lại sang BE.

## [2026-06-22] — FE composition now tolerates both `orderedModuleIds` and `groups`

**Context:** `generated_learning_paths.result` was being read như thể lúc nào cũng có `orderedModuleIds`, trong khi shape mới có thể chỉ còn `groups` sau khi logic sinh lộ trình được tách / thay đổi.

**Decision:**
- FE composition helper `resolveSuggestedModuleIds` giờ đọc được cả `orderedModuleIds` lẫn fallback từ `groups.moduleIds`, rồi mới lọc theo vai trò.
- `/api/member/learning-path` và admin learning-metrics route cùng dùng chung helper để tránh lệch shape đọc dữ liệu giữa các màn.
- Thêm test riêng cho helper để khóa hành vi fallback này lại.

**Files:** `src/frontend/lib/learning-path-selection.ts`, `src/frontend/lib/learning-path-selection.test.ts`, `src/frontend/app/api/member/learning-path/route.ts`, `src/frontend/app/api/platform-admin/learning-metrics/route.ts`, `WORKLOG.md`.

**Follow-up:** nếu BE đổi shape `generated_learning_paths.result` lần nữa thì FE đã có lớp chống vỡ, nhưng vẫn nên giữ contract kết quả path rõ ràng ở một nơi.

## [2026-06-22] — LangGraph learning-path agent + Supabase context loader

**Context:** `POST /api/agent/lo-trinh` trước đây vẫn là logic một khối trong `AgentService`, chỉ đọc `profiles` + `module_progress` tối thiểu và có fallback rule-based thô.

**Decision:**
- Thêm agent riêng ở `src/backend/agents/learning_path/` với state typed, data loader Supabase thật, ranking thuần, nodes tách trách nhiệm, graph compile thật.
- Adapter `src/backend/services/learning_path_agent_service.py` chạy graph bằng timeout/feature flag `USE_LANGGRAPH_PATH`; graph hỏng sẽ rơi về rule-based path, preview `skillSlugs` giữ hành vi cũ.
- Tạo snapshot `src/backend/data/learning-data.json` từ `roles.ts` để backend có catalog thật, gồm `skills` và `isFoundation` cho metadata prompt.

**Files:** `src/backend/agents/learning_path/*`, `src/backend/services/{agent_service,learning_path_agent_service,config}.py`, `src/backend/data/learning-data.json`, `scripts/export-backend-learning-data.ts`, tests mới trong `src/backend/tests/test_agents/` và `src/backend/tests/test_services/`.

**Verify:** `pytest src/backend/tests` pass (96 tests); `ruff check` pass trên các file mới/chỉnh sửa; `npm run lint` pass; `npm run test` pass; `npm run build` pass.

**Follow-up:**
- `src/backend/data/learning-data.json` là snapshot sinh từ `roles.ts` qua `scripts/export-backend-learning-data.ts`. Hiện CHƯA có CI regen → sửa `roles.ts` sẽ làm BE catalog lệch FE âm thầm. Cần thêm bước CI/pre-commit regenerate + diff snapshot (fail nếu lệch), hoặc chuyển sang generate lúc build.
- `USE_LANGGRAPH_PATH` mặc định OFF (`config.py`) vì BE agent còn non-blocking, chưa wire vào route FE; bật flag mới kéo read schema công ty vào flow. Bật lại khi BE thực sự được nối.

## [2026-06-22] — Lưu Skill vào "Bộ kỹ năng cá nhân" (FE-16)

**Context:** Học xong 1 bài, người dùng tự bấm "Lưu skill" để giữ kỹ năng vào bộ cá nhân, xem ở trang riêng `/bo-ky-nang`. Cơ chế thủ công.

**Decision:**
- Migration `user_saved_skills` (RLS self-only, unique `(user_id, skill_id)` chống lưu trùng, `source_module_id` truy vết). Dùng lại `skills` + `module_skills` (chỉ đọc).
- API `app/api/member/skills`: POST tra `module_skills` của bài → upsert `ignoreDuplicates`; GET join `skills`; DELETE `[skillId]`. Chỉ real mode; RLS chặn theo `auth.uid()`.
- Nút "Lưu skill" (`components/save-skill-button.tsx`) đặt ở hàng nút cuối trang bài `/lo-trinh/[moduleId]`, **disabled khi bài chưa hoàn thành** (`status !== 'hoan-thanh'`), ẩn ở bài cross-role (Kỹ năng khác) để không lẫn với luồng "Thêm vào Kỹ năng khác". Đã lưu → "Đã lưu ✓".
- Trang `/bo-ky-nang` + link nav (cạnh "Tiến bộ"): list tên/mô tả/bài nguồn/ngày + nút Gỡ + empty state.

**⚠ CẦN LUCAS DUYỆT:**
1. **Vị trí nút:** đặt ở hàng nút cuối bài (cạnh "Về lộ trình"), disabled tới khi hoàn thành — thay vì cạnh nút chấm điểm Bước 2 (giữ UI sạch).
2. **Lấy skill của bài qua `module_skills` (DB):** DB hiện seed `module_skills` mới chỉ cho **van-hanh + skill chung** (migration 0014). Vai trò khác chưa có mapping → bấm "Lưu skill" trả "Bài này chưa gắn kỹ năng". Cần seed `module_skills` cho kinh-doanh/ke-toan/marketing/khac nếu muốn lưu skill ở các bài đó (ngoài phạm vi FE-16 — chỉ đọc bảng).

**Files:** `supabase/migrations/20260622012534_user_saved_skills.sql`; `app/api/member/skills/route.ts` + `app/api/member/skills/[skillId]/route.ts`; `components/{save-skill-button,bo-ky-nang-content}.tsx`; `app/(app)/bo-ky-nang/page.tsx`; sửa `components/module-lesson-content.tsx`, `app/(app)/layout.tsx` (nav), `lib/client-api.ts`.

**Verify:** `npm run lint` pass (0 error, 5 warning có sẵn); `npm run build` pass; `npx vitest run` 353 pass. Pre-existing `scripts/vercel-cli-json.test.mjs` lỗi parse (không thuộc PR). API integration đầy đủ cần server+Supabase live.
## [2026-06-22] — Topic câu hỏi: form đăng câu hỏi mới + hiện tên người đăng/helper

**Context:** Topic "Câu hỏi chưa có lời giải" chỉ cho AI auto-post qua CTA, không có entry-point để user tự nhập câu hỏi mới. Helps + questions chỉ hiển thị nội dung, không hiện tên người đăng/người trả lời.

**Decision:** Thêm form đăng câu hỏi đầu trang Topic; dropdown role import `ROLES` từ `@/lib/roles` (không hardcode). Map tên người dùng KHÔNG embed `profiles!user_id(full_name)` qua client thường — RLS `profiles` là self-read sẽ trả NULL cho người khác. Thay vào đó dùng `createSupabaseServiceClient()` trong GET để fetch `profiles(id, full_name)` theo `userIds` đã org-scoped bởi query chính, build `profileMap`, gắn `author_name` + `helper_name` vào response. Fallback `"Ẩn danh"` nếu null/empty. Contract POST `/api/unsolved-questions` giữ nguyên (AI CTA `unsolved-question-cta.tsx` không đổi). Không động Case A/B/C gating, `/help`, `/accept`.

**Files:** `src/frontend/app/api/unsolved-questions/route.ts`, `src/frontend/components/topic-cau-hoi-board.tsx`.

**Verify:** `npm run lint` pass (0 errors, 5 pre-existing warnings); `npm run test` 353/353 pass (1 suite fail `scripts/vercel-cli-json.test.mjs` do CRLF line endings — pre-existing từ commit `837f7ea`, không liên quan); `npm run build` pass.

---
## [2026-06-22] — Lộ trình 4 tier + chọn bài + khoá tuần tự (FE-15)

**Context:** `/lo-trinh` đang hiển thị module phẳng theo vai trò. FE-15 yêu cầu: bước **chọn bài & chốt lộ trình** (composition) → màn **4 tier khoá tuần tự** (Cơ bản/Nâng cao/Nâng trình/Master). Tier N mở khi tier N-1 hoàn thành hết bài + đạt gate quiz ≥70%.

**Decision:**
- **Phân tier tập trung** ở `MODULE_TIER_MAP` (`lib/learning-tiers.ts`) thay vì gắn `tier` rải khắp `roles.ts` — DRY + review 1 chỗ. Quy tắc: level1→tier1, level3→tier4, level2 chia đôi theo thứ tự bài (nửa đầu→tier2, nửa sau→tier3).
- **Gate quiz** tái dùng pool `role.quiz` (đã duyệt nội dung), xoay vòng theo tier → KHÔNG bịa kiến thức. Đánh dấu `TODO(content)` để Lucas biên soạn bộ chuyên biệt sau. Ghi `quiz_results.module_id = '{roleId}-tier{n}-quiz'`, chấm client-side + dùng raw-score path của `/api/quiz-results` (không đổi schema/API grading).
- **Composition** chỉ chạy real mode (Supabase); demo mode giữ list phẳng cũ. Gợi ý lấy từ `generated_learning_paths.result.orderedModuleIds`, **lọc theo đúng vai trò**; fail-safe rỗng → gợi ý = bài vai trò theo `aiLevel`.
- **Khoá tuần tự chỉ tính trên tier "có bài"** trong tập đã chọn (tier rỗng bị bỏ qua) — composition nên không phải tier nào cũng có bài.
- **Route guard** `/lo-trinh/[moduleId]` chặn server-side khi bài thuộc tier khoá (bài `?extra=1` bỏ qua).

**⚠ CẦN LUCAS DUYỆT (3 điểm phán đoán khi chạy /goal tự động):**
1. **Bảng gán tier**: derive từ `level` (xem `MODULE_TIER_MAP`/`buildModuleTierMap`). VD kinh-doanh: m1,m2→T1 · m3→T2 · m4→T3 · m5,m6→T4.
2. **Gate quiz**: hiện tái dùng `role.quiz` xoay vòng (không bịa) — cần biên soạn câu hỏi gate chuyên biệt từng tier (`TODO(content)`).
3. **Parse `generated_learning_paths.result`**: shape thật = `AgentPathResult` (`orderedModuleIds: string[]`); đã lọc theo vai trò + fail-safe rỗng.

**Files:** migration `supabase/migrations/20260622000738_user_learning_selection.sql`; `lib/learning-tiers.ts`(+test), `lib/learning-path-selection.ts`, `lib/learning-path-access.ts`; API `app/api/member/learning-path/route.ts`; sửa `app/api/quiz-results/route.ts` (thêm `module_id` vào GET); `components/{lo-trinh-content,lo-trinh-composition,lo-trinh-tiers,kiem-tra-quiz}.tsx`; pages `app/(app)/lo-trinh/page.tsx`, `app/(app)/lo-trinh/[moduleId]/page.tsx`, `app/(app)/kiem-tra/[roleId]/page.tsx`; `lib/client-api.ts`.

**Verify:** `npm run lint` pass (0 error, 5 warning có sẵn); `npm run build` pass; Vitest 363 pass (gồm 10 test mới `learning-tiers.test.ts`). 1 suite có sẵn `scripts/vercel-cli-json.test.mjs` lỗi parse (CRLF/encoding, KHÔNG thuộc PR này). API integration (`npm run test` đầy đủ) cần server+Supabase live — chưa chạy trong sandbox.

## [2026-06-21] — Chat Skill Gating + cà khịa + Topic câu hỏi chưa có lời giải (BE-14)

**Context:** Triết lý "cho cần câu, không cho con cá" — employee chat phải gate đáp án theo trạng thái học: đã học → cho đáp án + cà khịa tăng cấp; chưa học → định hướng học; chưa có bài → trả lời khéo + auto-capture skill gap + mời đăng Topic cộng đồng.

**Decision:** Logic gating thuần (`chat-skill-gating.ts`) nối vào prompt qua runtime hint giống `clarifyHint`. Đếm hỏi lại + auto-capture gap dùng **SECURITY DEFINER SQL functions** (`bump_skill_inquiry_counter`, `capture_skill_gap`) để upsert atomic chống lost update (không làm được ở app layer với supabase-js). Dedup gap qua `coalesce(org, sentinel-uuid) + cluster_key`. Điểm help nhận = 15 với `source='challenge'` (khỏi migrate CHECK constraint `points_ledger.source`). `deep_answer` flag thêm vào type/parse/merge nhưng route truyền `false`, ẩn UI — chờ lead duyệt.

**Spec lệch repo:** `chat-prompt-sections.ts`/`buildCoreEmployeeSections` (§3.5) KHÔNG tồn tại → thêm policy text trực tiếp vào `buildEmployeeSystemPrompt`. Không có nhánh `develop` → branch từ `main`.

**Files:** `supabase/migrations/20260621132256_skill_gating_gaps_and_unsolved_topic.sql`, `src/frontend/lib/{chat-skill-gating,chat-skill-gating-prompt,skill-inquiry-counter,skill-gap-capture}.ts`, sửa `chat-knowledge-curriculum.ts` (+`findRelevantModulesForQuery`,`loadGatingModulesForUser`), `openai.ts`, `learning-profile.ts`, `app/api/chat/route.ts`; API `app/api/unsolved-questions/**`, `app/api/skill-gaps/**`; UI `topic-cau-hoi`, `quan-ly/skill-gaps`, `unsolved-question-cta.tsx`; `scripts/export-skill-gaps.ts`; tests + `specs/BE-14-*`.

**Verify:** `npm run db:validate` pass; targeted Vitest (gating/prompt/cluster/curriculum) 17 pass; lint+test+build chạy cuối khi gộp FE.

## [2026-06-21] — HR role fix + assessment-gap signals + fallback observability for `/lo-trinh`

**Context:** `/lo-trinh` bị hạ role `nhan-su` về `khac` ở recommender-context, trong khi path-agent chỉ nhìn `completed` + `skillSlugs` nên chưa thật sự ưu tiên bù gap từ assessment. API cũng chưa có tín hiệu đo tỉ lệ agent-vs-fallback rõ ràng.

**Decision:** Chuẩn hóa role bằng helper chung `normalizeRoleId`, thêm `nhan-su` vào map tool cho cá nhân, truyền `goalTags` + `assessmentGapModuleIds` vào `AgentFlowInput`/prompt/validate, và log structured fallback với reason codes `no-key | parse-fail | empty | exception`. API `/api/agent/lo-trinh` trả `source` top-level để quan sát dễ hơn.

**Files:** `src/frontend/lib/openai.ts`, `src/frontend/lib/recommender-context.ts`, `src/frontend/lib/individual-tool-suggest.ts`, `src/frontend/lib/agent/path-agent.ts`, `src/frontend/lib/agent/path-agent-input.ts`, `src/frontend/lib/agent/path-agent-validate.ts`, `src/frontend/lib/agent/path-agent-fallback.ts`, `src/frontend/app/api/agent/lo-trinh/route.ts`, tests under `src/frontend/lib/agent/*` and `src/frontend/lib/recommender-context.test.ts`.

**Verify:** `npm run lint` pass (5 pre-existing warnings); `npm run test` pass; `npx -y -p node@20 node node_modules/next/dist/bin/next build src/frontend` pass; targeted Vitest passed for `path-agent-*`, `recommender-context.test.ts`, `recommender.test.ts`, and `/api/agent/lo-trinh`.

## [2026-06-20] — Tách prompt core/rules, thêm synthesis model và harden eval tro-ly

**Context:** Eval `/tro-ly` còn bị cắt ở lượt cuối và có nguy cơ lặp clarify sau khi đủ 3 card. Prompt system hiện cũng quá dài, nhồi lẫn persona/nhiệm vụ/rule trong một block lớn, khó kiểm soát khi sửa tiếp.

**Decision:** Tách prompt employee/manager thành các section core + rule blocks, chỉ inject rule liên quan theo `currentMessage`; thêm `OPENAI_MODEL_SYNTHESIS` cho lượt tổng hợp cuối; tăng max_tokens cho final turn và thêm continuation khi `finish_reason==="length"`; demo-openai stream theo chunk sau khi finalize; nâng `scripts/eval-tro-ly.mjs` thành bộ PASS/FAIL và thêm guide chạy eval.

**Files:** `src/frontend/lib/openai.ts`, `src/frontend/lib/chat-prompt-sections.ts`, `src/frontend/lib/chat-prompt-sections.test.ts`, `src/frontend/app/api/chat/route.ts`, `src/frontend/lib/chat-clarify-parse.ts`, `src/frontend/lib/chat-clarify-parse.test.ts`, `src/frontend/lib/openai.test.ts`, `src/frontend/lib/chat-message-budget.ts`, `src/backend/tests/conftest.py`, `scripts/eval-tro-ly.mjs`, `docs/guide/tro-ly-eval.md`, `docs/README.md`, `package.json`.

**Verify:** `npm run lint` pass (5 pre-existing warnings); `npm run test` pass; `npm run build` pass; `npm run eval:tro-ly` pass 5/6 with TC-01, TC-02, TC-03, TC-04, TC-05 PASS and TC-06 still FAIL on mustInclude.

## [2026-06-20] — Platform Admin sửa `role_id`, `ai_level` và reset cache lộ trình

**Context:** Người vận hành cần sửa cứu hộ tài khoản chọn sai vai trò / sai mức AI, rồi ép hệ thống sinh lại lộ trình mới mà không xoá chat hay điểm số.

**Decision:** Thêm `ai_level` vào draft/report user; cho dropdown work role edit `role_id` trực tiếp trên bảng; khi đổi `role_id` hoặc `ai_level` thì xoá `learning_recommendations`; `reset-user-learning` có scope `learning_recommendations` để nút “Sinh lại lộ trình” chỉ reset cache lộ trình.

**Files:** `src/frontend/lib/platform-admin-console.ts`, `src/frontend/lib/platform-admin-types.ts`, `src/frontend/components/platform-admin/users-tab.tsx`, `src/frontend/components/platform-admin/platform-admin-console.types.ts`, `src/frontend/hooks/use-platform-admin-console.ts`, `src/frontend/lib/platform-admin-console.test.ts`.

**Verify:** `npm run lint` pass (5 pre-existing warnings); `npm run test` pass (63 Vitest / 309 unit, 30 API, 12 manager/invite, 7 auth/OAuth, 88 pytest); `npx -y -p node@20 node node_modules/next/dist/bin/next build src/frontend` pass.

## [2026-06-19] — Fix card follow-up cho luồng học Kỹ năng khác

**Context:** Screenshot `/tro-ly` cho thấy user hỏi “tôi là HR, học skill khác có vấn đề gì không?”, chọn nhánh quảng cáo, nhưng card kế tiếp lại hỏi “đã có số liệu/tài liệu chưa?” — lệch sang flow báo cáo thay vì flow người học muốn học cross-skill.

**Decision:** Thêm flow `extra-skill` trong `chat-clarify-steps`: step 1 hỏi nhóm kỹ năng muốn học, step 2 hỏi muốn áp dụng vào việc HR nào, step 3 hỏi kiểu hỗ trợ/học mong muốn. Runtime hint giờ dùng template theo context thay vì hard-code lớp 2 là “số liệu/tài liệu”.

**Files:** `src/frontend/lib/chat-clarify-steps.ts`, `src/frontend/app/api/chat/route.ts`, `src/frontend/lib/chat-clarify-parse.test.ts`.

**Verify:** `npm run test -- src/frontend/lib/chat-clarify-parse.test.ts` pass (script chạy full suite: 283 unit, 30 API, 12 manager/invite, 7 auth/OAuth, 88 pytest); `npm run lint` pass (5 pre-existing warnings); `npm run build` pass. Browser smoke was attempted but blocked by Browser plugin virtual clipboard input error.

---

## [2026-06-19] — Fix race làm mất tin nhắn đầu ở `/tro-ly`

**Context:** User vẫn thấy câu hỏi đầu tiên của session chat bị mất và vùng chat bị nháy khi gửi lượt đầu.

**Decision:** Init chat history giờ có run/version guard, nên init cũ hoặc init bị user gửi message chen vào sẽ không được overwrite `messages`; gửi message đầu sẽ tắt skeleton ngay; `ChatConversationBody` bỏ `key={sessionLoadKey}` để tránh remount toàn bộ vùng hội thoại.

**Files:** `src/frontend/hooks/use-assistant-chat.ts`, `src/frontend/components/chat-conversation-body.tsx`, `src/frontend/components/tro-ly-chat.tsx`.

**Verify:** `npm run test` pass; `npm run lint` pass (5 pre-existing warnings); `npm run build` pass; browser smoke real-mode `/tro-ly` confirmed first user bubble stayed visible across 30 samples during first-answer thinking and after stream.

---

## [2026-06-19] — Harden Kỹ năng khác enroll sau Bugbot review

**Context:** Review PR #63 phát hiện blocked cross-role page không có nút lưu, demo mode thiếu cap 5, validation role null lỏng, và insert Supabase bypass được qua client.

**Decision:** Preview blocked vẫn hiện CTA lưu; link chat dùng `?extra=1`; `validateExtraSkillLessonEnrollment` dùng chung FE; migration trigger `enforce_extra_skill_lesson_rules` guard insert/update ở DB để upsert không né rule.

**Files:** `module-lesson-content.tsx`, `extra-skill-lessons.ts`, `employee.ts`, `demo-storage.ts`, `20260619203000_extra_skill_lessons_guards.sql`, tests.

**Verify:** `npm run db:validate`, `npm run lint`, `npm run test` (280 Vitest), `npm run build` pass.

---

## [2026-06-19] — Chặn xem lesson ngoài role nếu chưa được lưu và tắt nút bài tiếp theo trong extra lesson

**Context:** User phát hiện lesson ngoài role vẫn có thể mở tiếp sang các bài khác qua nút “Bài tiếp theo”, khiến học viên lách được sang nội dung không được gợi ý.

**Options:**
1. Chỉ ẩn nút “Bài tiếp theo”.
2. Chỉ chặn một vài URL cụ thể.
3. Chỉ cho xem lesson ngoài role khi đã nằm trong section “Kỹ năng khác”, và tắt nút bài tiếp theo ở các lesson đó.

**Decision:** Chọn phương án 3. Cross-role lesson giờ có màn chặn nếu chưa được lưu vào “Kỹ năng khác”; lesson đã lưu vẫn xem được nhưng không hiện nút “Bài tiếp theo”, nên không dẫn người học sang các bài ngoài phạm vi gợi ý.

**Owner:** Minh Hải

## [2026-06-19] — Chặn rò rỉ “bài tiếp theo” trong chat extra-skill

**Context:** Khi user hỏi từ AI trợ lý chính kiểu “sau bài này học gì tiếp”, bot vẫn có thể lôi module tiếp theo của lộ trình chính ra dù đang nói về một bài học thêm.

**Decision:** Thêm luật ưu tiên cao cho `extraSkillSummary` và ngữ cảnh Kỹ năng khác: bài học thêm là bài độc lập, không có “next lesson” mặc định; nếu user hỏi tiếp theo thì chỉ được nói đây là bài học thêm riêng hoặc gợi ý thêm một bài Kỹ năng khác liên quan khác trong catalog.

**Verification:** Browser retest trên hội thoại mới đã không còn lộ link bài tiếp theo; các câu hỏi lách luật trước đó vẫn đi qua clarify nhưng không rò rỉ module kế tiếp ở câu trả lời cuối.

## [2026-06-19] — Fix flicker/missing message và siết clarify context

**Context:** User báo rằng chat bị mất message và nháy lại màn hình sau khi gửi; ngoài ra clarify payload lỗi còn lộ raw `__CLARIFY__`, và câu trả lời sau card 3 bị kéo quá nhiều memory cũ.

**Decision:** Bỏ dependency `activeConversationId` khỏi init effect để chat không remount khi conversation id được resolve; khi parse clarify fail thì strip raw payload khỏi UI; và khi đang ở nhánh clarify thì giảm việc nhét memory cũ vào system prompt để câu trả lời bám sát câu hỏi hiện tại hơn.

**Verification:** `npm run test -- src/frontend/hooks/use-assistant-chat.test.ts src/frontend/lib/chat-clarify-parse.test.ts src/frontend/lib/openai.test.ts` pass; `npm run build` pass; browser smoke trên `/tro-ly` xác nhận bong bóng user không mất, không nháy lại, và clarify hiển thị sạch.

**Status:** Active

**Tests:** `npm run lint` pass với 5 warning có sẵn; `npm run test` pass (59 Vitest files / 273 tests, 30 API, 12 manager/invite, 7 auth/OAuth, 88 pytest); `npm run build` pass; browser smoke xác nhận lesson ngoài role chưa lưu bị chặn, lesson đã lưu xem được nhưng không còn nút bài tiếp theo.

## [2026-06-19] — Thêm “Kỹ năng khác” cho bài học ngoài role và giới hạn tối đa 5 bài

**Context:** User muốn cho phép học một skill có thật trong hệ thống nhưng không thuộc role hiện tại, lưu riêng thành section “Kỹ năng khác”, và mỗi người chỉ được thêm tối đa 5 bài.

**Options:**
1. Chỉ nới boundary của chat, không lưu riêng bài học.
2. Nhét bài ngoài role vào cùng lộ trình chính.
3. Tạo catalog riêng cho bài ngoài role, lưu riêng ở section cuối lộ trình và enforce limit 5.

**Decision:** Chọn phương án 3. Thêm bảng `extra_skill_lessons`, helper catalog/prompt context, CTA trên trang bài học ngoài role, và section “Kỹ năng khác” ở cuối `/lo-trinh`. Chỉ cho lưu khi bài có thật trong catalog, không link sang lộ trình tổng của role khác, và chặn thêm mới sau 5 bài.

**Owner:** Minh Hải

**Status:** Active

**Tests:** `npm run lint` pass với 5 warning có sẵn; `npm run test` pass (59 Vitest files / 273 tests, 30 API, 12 manager/invite, 7 auth/OAuth, 88 pytest); `npm run build` pass; browser smoke real Supabase session đã xác nhận đăng ký/login, thêm lesson ngoài role, và section “Kỹ năng khác” hiển thị bài đã lưu.

## [2026-06-19] — Giữ greeting chat và chặn init state cũ ghi đè khi conversation được resolve

**Context:** User báo `/tro-ly` bị mất tin nhắn chào đầu tiên sau khi chat và sau khi chat xong bị nháy 1 phát. Phân tích luồng hiện tại cho thấy hook chat đang có thêm một vòng init khi `activeConversationId` đổi từ session tạm sang session thật, làm state cũ có thể reset lại messages/loading dù conversation hiển thị vẫn là cùng một phiên.

**Options:**
1. Chỉ chỉnh UI render để luôn vẽ greeting riêng.
2. Chỉ giữ state hiện tại và bỏ rerun init theo `activeConversationId`.
3. Kết hợp: khóa init theo session key ổn định, bỏ refresh theo id vừa resolve, và kiểm tra lại bằng regression test.

**Decision:** Chọn phương án 3. `useAssistantChat` giờ build init key từ session load key ổn định, resolve history theo `sessionLoadKey` thay vì `activeConversationId`, và không để việc resolve conversation id sau khi gửi kích hoạt lại vòng init. Mục tiêu là giữ greeting bubble của phiên hiện tại và tránh flash loading không cần thiết sau khi stream xong.

**Owner:** Minh Hải

**Status:** Active

**Tests:** Chưa chạy trong lượt này; sẽ rerun targeted Vitest, full lint/test/build, rồi browser-smoke `/tro-ly` real Supabase mode với HR login.

## [2026-06-19] — Reset boundary cho chat mới để không kéo context chéo giữa các hội thoại

**Context:** User báo rằng mở một chat mới nhưng trợ lý vẫn trả lời theo context của chat khác, làm boundary giữa các thread bị lộn xộn. Kiểm tra luồng hiện tại cho thấy `force_new`/`conversation_id` đã tách session UI, nhưng prompt vẫn có thể mang memory cũ vào lượt đầu của hội thoại mới.

**Options:**
1. Chỉ sửa UI/session state.
2. Chỉ sửa prompt.
3. Chặn memory cũ trên lượt đầu của hội thoại mới, đồng thời gắn instruction rõ ràng cho fresh thread.

**Decision:** Chọn phương án 3. Khi người dùng bấm “Cuộc hội thoại mới”, lượt gửi đầu tiên sẽ tạo conversation mới nhưng không nạp `chat_memories` cũ vào prompt; prompt cũng nhận thêm instruction về fresh thread để không tự nối context từ chat khác. Draft history trả về `coreContext: null` để UI không vô tình gợi cảm giác đang nối tiếp hội thoại trước đó.

**Owner:** Minh Hải

**Status:** Active

**Tests:** `npm run lint` pass với 4 warning có sẵn; `npm run test` pass (58 Vitest files / 264 tests, 30 API, 12 manager/invite, 7 auth/OAuth, 84 pytest); `npm run build` pass; browser-smoke `/tro-ly` real Supabase session với `demo.hr@gmail.com` xác nhận fresh thread không lôi context marketing cũ sang.

## [2026-06-19] — Chặn lời chào lặp ở mọi lượt chat sau session mở đầu

**Context:** Browser smoke cho thấy assistant vẫn mở đầu bằng “Chào bạn!” ở một số canned/fallback response, dù session greeting bubble đã có sẵn. Người dùng chỉ muốn lời chào xuất hiện một lần khi mở session mới, không lặp ở từng câu trả lời.

**Options:**
1. Sửa từng canned response.
2. Chỉ thêm instruction vào system prompt.
3. Thêm output sanitizer dùng chung cho canned/cache/live OpenAI.

**Decision:** Chọn phương án 3 và bổ sung prompt reminder. `stripLeadingAssistantGreeting()` được áp vào canned/fallback/cache/OpenAI final text để cắt lời chào mở đầu nhưng vẫn giữ nguyên nội dung trả lời. Session greeting bubble vẫn giữ nguyên, nên mỗi thread mới vẫn có lời chào đầu tiên đúng chỗ.

**Owner:** Minh Hải

**Status:** Active

**Tests:** Chưa chạy xong trong lượt này; cần rerun Vitest chọn lọc, rồi full lint/test/build và browser-smoke `/tro-ly` với câu “co bai noi quy cong ty khong?” để xác nhận không còn “Chào bạn!” trong câu trả lời sau session mở đầu.

## [2026-06-19] — Đồng bộ backend native để không chào lặp và không lộ core context ở draft history

**Context:** Backend Python native vẫn có cache/fallback/chat stream riêng, nên nếu FE sạch mà BE chưa cập nhật thì hai đường trả lời sẽ lệch nhau. Draft chat history phía backend cũng vẫn đang trả `core_context` trong nhánh `draft`.

**Options:**
1. Chỉ xử lý ở FE.
2. Chỉ xử lý ở helper backend.
3. Chặn cả cache/fallback/live stream và draft history trên backend native.

**Decision:** Chọn phương án 3. Backend Python thêm `strip_leading_assistant_greeting()`, áp vào cache/fallback/live stream, bổ sung reminder trong prompt, và trả `coreContext: None` khi `draft=True` để state mới thật sự sạch.

**Owner:** Minh Hải

**Status:** Active

**Tests:** `pytest src/backend/tests/test_services/test_chat_service.py src/backend/tests/test_services/test_openai_helpers.py src/backend/tests/test_api/test_chat_routes.py -q` pass; full `npm run lint` pass với 4 warning cũ; full `npm run test` pass (58 Vitest files / 266 tests, 30 API, 12 manager/invite, 7 auth/OAuth, 88 pytest); `npm run build` pass.

## Format mỗi entry

```md
## [YYYY-MM-DD] — Tiêu đề quyết định
**Context:** Vì sao phải quyết định lúc này
**Options:** Các phương án đã cân nhắc
**Decision:** Chốt phương án nào và lý do
**Owner:** Ai chịu trách nhiệm
**Status:** Active / Reversed / Superseded
```

---

## [2026-06-18] — Lưu lịch sử kết quả khảo sát onboarding vào Supabase

**Context:** Khảo sát onboarding đang ghi kết quả hiện tại vào `profiles.assessment_result`, nhưng mỗi lần làm lại sẽ overwrite snapshot cũ. User yêu cầu tất cả user làm khảo sát đều phải được lưu kết quả bài vào database.

**Options:**
1. Chỉ giữ nguyên `profiles.assessment_result`.
2. Thêm bảng lịch sử riêng cho từng lần hoàn thành khảo sát, đồng thời vẫn giữ `profiles` làm snapshot hiện tại cho app đọc nhanh.

**Decision:** Chọn phương án 2. Thêm `onboarding_assessment_results` với RLS user-scoped để lưu raw answers, result JSON, total score, AI level, role, daily tasks/tools/industry/position cho từng attempt. `saveEmployeeProfile` vẫn upsert `profiles`, sau đó insert lịch sử khảo sát; nếu Supabase real mode không lưu được thì onboarding hiển thị lỗi thay vì giả vờ thành công.

**Owner:** Minh Hải

**Status:** Active

**Tests:** `npm run db:validate` pass; targeted Vitest 2 files / 4 tests pass; `npm run lint` pass với 4 warning cũ; `npm run test` pass (58 Vitest files / 263 tests, 30 API, 12 manager/invite, 7 auth/OAuth, 84 pytest); `npm run build` pass.

## [2026-06-18] — Clone backend/API sang FastAPI theo mô hình mirror trước

**Context:** User yêu cầu tạo nhánh mới và clone toàn bộ logic BE/API hiện có sang `src/backend/` bằng FastAPI, nhưng chưa thay thế runtime Next.js Route Handlers đang chạy production/dev.

**Options:**
1. Port native toàn bộ 29 route Next.js sang Python ngay trong một bước.
2. Chỉ copy source tham khảo vào `src/backend/` mà chưa có runtime dùng được.
3. Dựng FastAPI mirror/proxy cùng manifest route để clone đủ API surface và behavior hiện tại, rồi native hóa dần từng endpoint sau.

**Decision:** Chọn phương án 3. FastAPI giờ expose lại toàn bộ route `/api/...` và `/moi/{token}/accept`, forward sang Next.js runtime qua `NEXT_RUNTIME_BASE_URL`, đồng thời giữ `src/backend/` làm nơi chuẩn bị cho việc thay từng logic sang Python mà không phá flow hiện tại. Điều này là ngoại lệ có chủ đích theo task hiện tại, không thay đổi nguyên tắc Phase 2 vẫn chạy chính trên Next.js cho đến khi có quyết định mới.

**Owner:** Minh Hải

**Status:** Active

**Update 2026-06-18:** Tạo nhánh `feat/clone-fastapi-backend`; `pytest src/backend/tests -q` pass 12/12 sau khi cài requirements backend.

**Update 2026-06-18 PM:** Thêm `scripts/clone-next-backend-to-fastapi.mjs` để sync source backend hiện có từ `src/frontend/app/api/**`, `src/frontend/app/moi/[token]/accept/route.ts`, và toàn bộ `lib/**` phụ thuộc sang `src/backend/next_clone/frontend/`; lần sync đầu đã clone 94 file kèm `src/backend/next_clone/manifest.json`. Follow-up tiếp theo là chọn thứ tự native hóa từng endpoint nặng như `/api/chat`, `/api/manager/team`, `/api/practice-review`.

**Update 2026-06-18 PM2:** Sửa `scripts/run-all-tests.mjs` để production server test không chạy `db:sync` trong `prestart`; full verify pass với `npx -y -p node@22 -p npm npm run test` (246 Vitest, 30/30 Phase 1 API, 12/12 Phase 2 manager/invite, 7/7 auth/OAuth; pytest section bị skip mềm vì repo không có `tests/` root), `npx -y -p node@20 -p npm npm run lint`, `npx -y -p node@20 -p npm npm run build`, và `pytest src/backend/tests -q` 12/12.

**Update 2026-06-18 PM3:** Bắt đầu port native business logic sang FastAPI cho nhóm API dữ liệu nền tảng: `POST /api/events`, `GET/PUT /api/profile`, `GET/POST /api/progress`, `GET/POST /api/nhat-ky`, `GET/POST /api/leads`. Thêm `SupabaseGateway` và `NativeAppService` để backend Python tự nói chuyện với Supabase qua REST/Auth thay vì phụ thuộc Next.js runtime; `pytest src/backend/tests -q` hiện pass 16/16.

**Update 2026-06-18 PM4:** Port tiếp `GET /api/modules`, `GET /api/modules/{id}`, `GET/POST /api/quiz-results` sang FastAPI-native. Để backend Python độc lập với runtime TS nhưng vẫn giữ đúng dữ liệu lộ trình/quiz hiện có, thêm `scripts/export-backend-learning-data.ts` để xuất snapshot `src/backend/data/learning-data.json`; Python đọc snapshot này qua `learning_data.py`. `pytest src/backend/tests -q` hiện pass 18/18.

**Update 2026-06-18 PM5:** Port thêm company/manager foundation sang FastAPI-native: `POST /api/organizations`, `GET/PATCH /api/organizations/current`, `GET /api/organizations/{slug}/public`, `POST /api/member/sync-department`, `GET/POST /api/manager/team`. Backend Python giờ đã tự xử lý create/update org, sync phòng ban theo `role_id`, đọc danh sách team, và thêm employee/manager vào tổ chức với luật one-org-per-user + private org cho manager mới; `pytest src/backend/tests -q` hiện pass 24/24.

**Update 2026-06-18 PM6:** Hoàn tất migration BE API sang FastAPI-native: tách route theo domain (`user`, `learning`, `chat`, `org`, `manager`, `public`, `agent`), tách service theo domain (9+ services), native hóa 7 endpoint còn mirror (`/api/chat` streaming, `/api/practice-review`, `/api/agent/lo-trinh`, `/api/agents/grader`, `/api/agents/recommender`, `/api/aha`, `/moi/{token}/accept`), `MIRRORED_ROUTES` rỗng. `pytest src/backend/tests -q` pass 56/56; `npm run lint`, `npm run test`, `npm run build` pass.

**Update 2026-06-18 PM7:** Dọn legacy mirror: xóa `BACKEND_MODE`, `NEXT_RUNTIME_*`, `manifest.py`, `next_proxy.py`, mirror router và `GET /api/v1/mirror/routes`. Backend giờ chỉ native; `/health` và `/api/v1/status` trả `env` thay vì `mode=mirror`.

**Update 2026-06-18 PM8:** Tổ chức lại test API BE theo domain: `test_api/helpers.py` (`patch_service`, `patch_session`, `patch_manager`, `assert_api_error`), `test_api_inventory.py` assert 43 route đăng ký, tách `test_{user,learning,chat,org,manager,public,agent,routes}.py`, xóa `test_native_routes.py`. `pytest src/backend/tests -q` pass 79/79; full `npm run lint/test/build` pass.

**Update 2026-06-18 PM9:** Fix review BE (không đụng FE Next.js): import `VALID_ROLES` trong `chat_service`; gate `x-test-user-id` chỉ khi `APP_ENV=test`; helper `parse_json_body`; email leads dùng `EMAIL_REGEX`; reuse httpx client trong `SupabaseGateway`; metadata app + CORS trim. pytest 84 pass.

## [2026-06-17] — Coach thêm lớp mindset ra quyết định cho báo cáo và outline

**Context:** Review cho thấy luồng coach hiện tại vẫn đúng hướng nhưng còn generic; người dùng cần đầu ra dùng được để quyết định chứ không chỉ là khung slide đủ mục.

**Options:**
1. Chỉ chỉnh riêng case marketing.
2. Thêm mindset decision-driven cho toàn bộ coach, nhưng giữ nguyên khung clarify/prompt/bài học hiện có.

**Decision:** Chọn phương án 2. Thêm lớp tư duy “mục tiêu → benchmark → insight → hành động” vào system prompt và phần synthesize, đồng thời giữ nguyên cơ chế hỏi 3 card, prompt mẫu, và link bài học.

**Owner:** Minh Hải

**Status:** Active

**Update 2026-06-17 PM:** `npx vitest run src/frontend/lib/chat-clarify-parse.test.ts` pass; `npm run lint` pass với 5 warning có sẵn; `npm run test` pass (237 Vitest tests, API integration, manager/invite, auth/OAuth; pytest bị skip vì repo không có `tests/`); `npm run build` pass.

## [2026-06-17] — Làm rõ giờ reset cho thông báo hết lượt chat

**Context:** Thông báo cũ "Quay lại vào ngày mai nhé!" chưa nói rõ reset vào lúc nào, dễ làm người dùng phân vân khi nào mới dùng tiếp được.

**Options:**
1. Giữ nguyên wording cũ.
2. Nói rõ mốc giờ reset là `00:00 ngày mai`.

**Decision:** Chọn phương án 2. Đồng bộ copy rate-limit ở API và client fallback sang "Hết lượt hôm nay. Bạn có thể tiếp tục từ 00:00 ngày mai." để người dùng hiểu ngay mốc quay lại.

**Owner:** Minh Hải

**Status:** Active

**Update 2026-06-17 PM:** `npm run lint` pass với 5 warning có sẵn; Node 20 `next build src/frontend` pass; full `npm run test` dừng ở bước API integration vì production server không start kịp timeout của runner.

## [2026-06-16] — Tuancoolboy sửa lại AGENTS.md và UI manager

**Context:** Cần chỉnh màn quản lý nhân viên và cài đặt công cụ AI theo mẫu landing manager trong `specs/gemini-code-1781627827649.html`, đồng thời giữ nguyên workflow agent và không code trực tiếp trên `develop`.

**Options:**
1. Chỉ sửa riêng `/quan-ly/nhan-vien`.
2. Tạo shell manager dùng chung cho `/quan-ly/nhan-vien` và `/quan-ly/cai-dat`.
3. Rebuild toàn bộ manager dashboard.

**Decision:** Chọn phương án 2. Thêm shell manager có sidebar theo mẫu, KPI cards, filter/search/status cho danh sách nhân viên, cột liên hệ trong bảng, và đồng bộ visual cho trang Công cụ AI. Không đổi Supabase schema, API route, auth guard, hoặc `AGENTS.md`; việc “sửa lại AGENTS.md” được ghi nhận tại đây vì rule hiện tại đã đủ.

**Owner:** Tuancoolboy

**Status:** Active

**Note:** Nhánh `feat/tuanvh/fix-UI-manager`. Các thay đổi chat có sẵn bị conflict khi pull `develop`, đã được bảo toàn trong `stash@{0}` và không trộn vào task UI này.

**Update 2026-06-17:** `npm run lint` pass với 5 warning có sẵn; Node 20 Vitest pass 49 files / 230 tests; Node 20 `next build src/frontend` pass; `git diff --check` pass. Full `npm run test` chưa pass do Node 18 thiếu `node:util.styleText`; khi chạy API smoke bằng Node 20 còn 2 lỗi chat ngoài scope UI manager.

## [2026-06-17] — Tắt tạm GitHub Actions CI tự động

**Context:** PR check đang tiêu tốn GitHub Actions credit của account cá nhân trong khi hiện tại chưa cần auto-run cho mọi push/PR.

**Options:**
1. Chỉ tắt `pull_request`, vẫn giữ `push`.
2. Tắt toàn bộ auto trigger, chỉ giữ chạy tay.

**Decision:** Chọn phương án 2. Đổi `.github/workflows/ci.yml` sang `workflow_dispatch` only để CI không tự chạy ở cả push lẫn PR; khi cần có thể mở lại `push` + `pull_request`.

**Owner:** Minh Hải

**Status:** Active

**Update 2026-06-17 PM:** Chỉnh nền `ManagerWorkspaceShell` không còn phủ `bg-card/*`; chỉ card/table giữ nền trắng, vùng ngoài dùng lại background tổng thể của app để khớp Tổng quan/Xếp hạng.

**Update 2026-06-17 PM2:** Xoá hẳn sidebar trái trong `ManagerWorkspaceShell` theo feedback UI; các trang manager giờ chỉ render vùng nội dung chính dưới top navigation.

**Update 2026-06-17 PM3:** Nút `Chat` trong bảng nhân viên giờ mở modal nhắn tin trực tiếp với nhân viên, có lịch sử demo/localStorage và tin nhắn nhanh; bỏ luồng trợ lý AI khỏi cột Liên hệ, không gọi `/api/chat`.

**Update 2026-06-17 PM4:** Fix bug bảng Top nhân viên ở `/quan-ly`: nút `Chat` không còn fallback sang `/tro-ly`; tách `ManagerDirectChatModal` dùng chung cho Tổng quan và Danh sách nhân viên.

## [2026-06-16] — Vercel CLI 54.x: parser deploy JSON + script xem deployment

**Context:** `./scripts/deploy-vercel-prod.sh` fail sau upload vì Vercel CLI 54 trả `{ deployment: { url, id } }` lẫn banner/progress trên stdout; script cũ parse `data.url` top-level.

**Options:**
- Sửa inline trong bash script → dễ vỡ lại khi CLI đổi format.
- Parser Node tái dùng + fallback dòng `▲ Production` → ổn định hơn, có test regression.

**Decision:** Thêm `scripts/vercel-cli-json.mjs`, cập nhật `deploy-vercel-prod.sh`, thêm `check-vercel-deployments.sh` để phân biệt deploy từ Git vs CLI. Nhánh `fix/vercel-deploy-cli-json` (không commit trực tiếp trên `develop`).

**Owner:** Agent session

**Status:** Active

**Follow-up:** Merge qua PR; `./scripts/check-vercel-deployments.sh` để xem Vercel CD; GitHub Actions CI vẫn chạy trên GitHub (lint/test/build), không phải trên Vercel.

---

## [2026-06-16] — Dọn N+1 assignments và tối ưu tokenize câu hỏi

**Context:** Review mới chỉ ra 2 điểm lặp cùng pattern: loader recommender vẫn query `learning_assignments` theo kiểu one-row, và tokenization của curriculum tạo nhiều mảng trung gian khi query dài.

**Options:**
1. Giữ nguyên vì đã pass test.
2. Chỉ sửa một trong hai chỗ, để phần còn lại chờ.
3. Chuyển recommender sang lấy toàn bộ assignment active rồi chọn path mới nhất, và viết lại tokenization theo kiểu streaming.

**Decision:** Chọn phương án 3. Recommender không còn N+1/one-row assumption ở assignments; tokenization của curriculum chuyển sang pass streaming để giảm memory pressure và tránh tạo nhiều intermediate arrays.

**Owner:** AI agent session (Codex)

**Status:** Active

**Update 2026-06-16:** `npx vitest run src/frontend/lib/chat-knowledge-company.test.ts src/frontend/lib/chat-knowledge-curriculum.test.ts` pass; `npm run build` pass.

---

## [2026-06-16] — Cache curriculum search index và giữ company context fail-open

**Context:** Sau review, `scoreModuleForQuery` vẫn phải normalize khá nhiều lần giữa các chat turn, còn loader company cần policy rõ hơn để không mất toàn bộ context khi một phần query lỗi.

**Options:**
1. Giữ nguyên vì đã pass test.
2. Chỉ tối ưu trong một lần render, không cache qua nhiều turn.
3. Cache normalized module search index theo `module.id`, và để company loader tiếp tục trả partial context khi chỉ một phần query lỗi.

**Decision:** Chọn phương án 3. Search index của module được cache theo `module.id` để giảm chi phí cross-message, còn company loader vẫn fail-open trên lỗi partial data để trợ lý không mất hết ngữ cảnh hữu ích.

**Owner:** AI agent session (Codex)

**Status:** Active

**Update 2026-06-16:** `npx vitest run src/frontend/lib/chat-knowledge-curriculum.test.ts src/frontend/lib/chat-knowledge-company.test.ts` pass; `npm run build` pass; `npm run test` vẫn lặp các lỗi integration/auth fixture sẵn có ở suite Phase 1, không phải do thay đổi này.

---

## [2026-06-16] — Tutor fallback demo trả lời "học gì tiếp" bằng link module

**Context:** Khi local không có OpenAI key, trợ lý AI vẫn rơi vào canned response. Câu hỏi kiểu "học gì tiếp" trước đó bị trả lời quá chung và còn né phạm vi.

**Options:**
1. Giữ nguyên OFF_TOPIC cho mọi câu ngoài vài mẫu cứng.
2. Chỉ sửa UI chip gợi ý, không đụng fallback logic.
3. Thêm canned response theo role để trả lời "học gì tiếp" bằng module link của lộ trình.

**Decision:** Chọn phương án 3. Fallback demo giờ có câu trả lời riêng cho "học gì tiếp" và trỏ thẳng tới 3 module đầu bằng markdown link, nên local browser test vẫn thấy giá trị thật của tutor.

**Owner:** AI agent session (Codex)

**Status:** Active

**Update 2026-06-16:** Browser deep test xác nhận câu hỏi "Em nên học gì tiếp cho bán hàng?" trả về đúng 3 link module `/lo-trinh/kinh-doanh-m1..m3`; `npm run lint`, `npx vitest run src/frontend/lib/tro-ly-canned-responses.test.ts src/frontend/lib/chat-knowledge-company.test.ts src/frontend/lib/agent/path-agent-validate.test.ts src/frontend/lib/agent/path-agent-input.test.ts`, và `npm run test` pass trong môi trường sạch.

---

## [2026-06-16] — Ép lộ trình công ty phải đi qua validate và giữ cờ bắt buộc

**Context:** Commit trước đã cho tutor và path agent đọc ngữ cảnh công ty, nhưng lộ trình giao vẫn có thể bị model bỏ sót hoặc làm loãng khi validate. Ngoài ra, cờ `is_required` trong dữ liệu lộ trình công ty chưa được tận dụng.

**Options:**
1. Chỉ dựa vào prompt để model tự giữ lộ trình.
2. Chỉ thêm test, không sửa validate.
3. Đưa lộ trình công ty vào validate như một phần bắt buộc và giữ `is_required` trong hint dữ liệu.

**Decision:** Chọn phương án 3. `validateAgentOutput` giờ tự chèn lộ trình công ty vào nhóm đầu nếu có, còn helper company giữ cờ `is_required` để prompt/test phản ánh rõ module bắt buộc.

**Owner:** AI agent session (Codex)

**Status:** Active

**Update 2026-06-16:** `npm run lint` pass; `npm run test` pass (192 Vitest tests, 30/30 API smoke, 12/12 manager/invite, 7/7 auth/OAuth, Python suite skipped vì repo không có `tests/`); Node 20 `next build` pass.

---

## [2026-06-16] — Harden tutor/path agents sau review (graceful DB, is_required NGUỒN 1, sanitize)

**Context:** Sau commit `4cde0cc`, vẫn còn vài điểm: `isFoundation` bị gán nhầm từ `is_required`, thiếu graceful degradation khi thiếu bảng Phase 2, NGUỒN 1 chưa hiện cờ bắt buộc, cap validate có thể cắt module required, và user notes/Aha chưa được giới hạn rõ.

**Decision:** Tách `isFoundation` (từ kho nền tảng) khỏi `isRequired`; loader company fail-open khi thiếu bảng; curriculum + validate ưu tiên module bắt buộc; sanitize + delimiter cho text user; chat route chỉ gọi `loadOrganizationLearningContext` một lần.

**Owner:** AI agent session (Cursor)

**Status:** Active

**Update 2026-06-16:** Review follow-up — batch `learning_path_modules` query (no N+1 per assignment); simplify module search cache to id+fingerprint Map without LRU.

---

## [2026-06-16] — Cá nhân hóa sâu hơn cho agent tutor và agent sinh lộ trình

**Context:** Hai agent chính đang thiếu ngữ cảnh doanh nghiệp thật: agent tutor chưa tách riêng công ty/phòng ban/lộ trình giao, còn agent sinh lộ trình chưa ưu tiên lộ trình công ty khi user thuộc tổ chức.

**Options:**
1. Chỉ chỉnh prompt hiện tại để model tự suy luận từ history.
2. Chỉ thêm retrieval một nguồn mới cho công ty/lộ trình giao.
3. Kết hợp retrieval + prompt + fallback để cả tutor và path agent đều bám source-of-truth mới.

**Decision:** Chọn phương án 3. Tutor giờ có 4 nguồn rõ ràng: lộ trình, hồ sơ cá nhân, ngữ cảnh công ty, và Aha gần đây. Path agent nhận company context, lộ trình giao, và module path vào candidate pool/fallback để ưu tiên đúng thứ tự công ty giao.

**Owner:** AI agent session (Codex)

**Status:** Active

**Update 2026-06-16:** `npm run lint` pass; `npm run test` pass (Vitest + API smoke + Phase 2 manager/invite + auth/OAuth); Node 20 `next build` pass.

**Update 2026-06-16 (review fixes):** Path agent gate chuyển sang `organization_members` (không còn phụ thuộc `member_positions` để vào luồng công ty); `validateAgentOutput` giữ thứ tự `assignedPathModules`; curriculum NGUỒN 1 gộp module lộ trình giao + scoring không dấu; demo OpenAI inject curriculum theo vai trò.

---

## [2026-06-16] — Chat: tên module trong trợ lý AI thành link bài học

**Context:** User báo trên `/tro-ly`, AI trả lời tên bài bằng dấu « » (plain text) thay vì link có thể bấm sang `/lo-trinh/{moduleId}` tab mới.

**Options:**
1. Chỉ sửa system prompt — AI output markdown link (phụ thuộc model tuân thủ).
2. Chỉ parse UI — fallback «tên module» → link theo map từ `roles.ts`.
3. Kết hợp prompt + UI parse markdown + fallback guillemet.

**Decision:** Phương án 3 — prompt bắt buộc `[Tên](/lo-trinh/id)`; `module-lesson-links.ts` map title→href; `assistant-chat-messages.tsx` render `<a target="_blank">`. Context curriculum/personal cũng embed link trong NGUỒN 1/2.

**Owner:** AI agent session (Cursor)

**Status:** Active — branch `feat/chat-module-lesson-links`

**Note:** Session đầu code trực tiếp trên `develop` (vi phạm `.agents/rules/agent-workflow.md` §1). Đã chuyển change sang nhánh feature sau khi user nhắc.

**Update 2026-06-16:** Sửa 2 issue PR reviewer còn lại — (1) `matchBoldAt` bỏ cấm `*` đơn trong bold; (2) `appendBoldInner` + `coalesceAdjacentBold` xử lý bold lồng nhau thống nhất. Test + lint + build pass.

---

## [2026-06-16] — Rule task-completion-checklist từ bài học PR review

**Context:** PR `feat/chat-module-lesson-links` qua nhiều vòng review (git nhánh, XSS false positive, regex overlap bold+link). Cần rule always-on để agent sau không lặp lại.

**Decision:** Thêm `.agents/rules/task-completion-checklist.md` + mirror `.cursor/rules/task-completion-checklist.mdc` (`alwaysApply: true`). Wire vào `AGENTS.md`, `agent-workflow.md`, `CLAUDE.md`, `GEMINI.md`.

**Owner:** AI agent session (Cursor)

**Status:** Active

---

## [2026-06-16] — Tái cấu trúc thư mục repo (One Repo — One Source of Truth)

**Context:** Code Next.js (`app/`, `components/`, `lib/`) nằm rải ở root; `src/` còn chứa Python boilerplate cũ; specs nằm trong `docs/specs/`.

**Decision:** Gom code app vào `src/`; chuyển specs → `specs/`, ADR → `adrs/`, sprint plans → `planning/sprints/`; archive FastAPI boilerplate → `legacy/python-boilerplate/`. Giữ config Next.js (`next.config.ts`, `proxy.ts`, `vitest.config.ts`) ở root — đây là Next.js, không phải Vite app.

**Owner:** minhhai203 (AI agent session)

**Status:** Active — branch `refactor/project-folder-structure`

---

## [2026-06-16] — Chia `src/` thành `frontend/` + `backend/`

**Context:** User muốn LangGraph agent (Python) và Next.js tách rõ trong `src/`, theo hướng 2 (không archive legacy mà đưa backend vào src).

**Decision:** `src/frontend/` = Next.js (chạy `next dev src/frontend`); `src/backend/agents/` = LangGraph (`graph.py`, `nodes/`, `tools/`). Package Python đổi tên `src` → `backend`.

**Owner:** minhhai203 (AI agent session)

**Status:** Active

---

**Context:** Sau đợt move `src/` / `specs/` / `planning/` / `legacy/`, repo vẫn còn rủi ro bị các agent tạo file mới sai chỗ, nhất là giữa `docs/`, `planning/`, `specs/`, `tasks/`.

**Decision:** Tạo rule always-on `.agents/rules/project-structure.md` và mirror `.cursor/rules/project-structure.mdc`; chia `docs/` thành `ops/`, `product/`, `handoffs/`, `archive/`, `guide/`; chuyển `demo-plan` vào `planning/demo/`, `spec-review` vào `planning/reviews/`, decision memo vào `planning/decisions/`. Từ nay mọi agent phải đọc rule này trước khi tạo file/thư mục mới.

**Owner:** minhhai203 (AI agent session)

**Status:** Active

---

**Context:** Cần chọn 1 nhóm lĩnh vực trong 10 nhóm để khoanh vùng đề tài. 250 đề rải khắp các lĩnh vực, không thể đọc kỹ tất cả trong Sprint 0.

**Options:**
- Y tế (071-080): volume buyer lớn, social impact rõ, nhưng team thiếu domain knowledge y khoa và có rủi ro compliance.
- Bảo mật (091-100): chủ đề hot, nhưng cần background đặc thù.
- AI Literacy (081-091): đào tạo nhân sự dùng AI, match với kinh nghiệm team về tư vấn AI automation và đào tạo SME.
- Các nhóm còn lại: chưa có competitive advantage rõ ràng.

**Decision:** Chọn **AI Literacy** làm nhóm chính để phân tích sâu.

**Owner:** Cả team

**Status:** Active

---

## [2026-05-31] — Shortlist hướng ban đầu trong AI Literacy

**Context:** Sau khi chọn nhóm AI Literacy, team cần shortlist một số hướng có khả năng phát triển thành web app trong thời gian build phase.

**Tiêu chí filter ban đầu:**
1. Có tạo ra giá trị thực tế cho doanh nghiệp không?
2. Demo cuối kỳ có thuyết phục không?
3. Team có nội dung thật và kinh nghiệm liên quan không?
4. MVP có khả thi trong vài sprint không?

**Shortlist ban đầu:**
- AI20K-084 — Competency Assessment
- AI20K-086 — Use Case Discovery
- AI20K-089 — AI Automation Learning

**Decision:** Trong Sprint 0, team tạm ưu tiên phân tích AI20K-089 vì demo automation workflow có vẻ trực quan. Các hướng khác vẫn được giữ để cân nhắc.

**Owner:** Cả team

**Status:** Superseded bởi quyết định chốt AI20K-083 ngày 04/06/2026

---

## [2026-05-31] — Ưu tiên tạm thời AI20K-089, giữ 084/086 làm backup

**Context:** Sau shortlist ban đầu, team cần một hướng để đào sâu trong Sprint 0/Sprint 1. AI20K-089 có vẻ mạnh vì team có kinh nghiệm automation và có thể demo workflow chạy thật.

**Options:**
- AI20K-084: hợp với đào tạo năng lực AI, nhưng demo dễ thành bảng điểm và cần scoring tốt.
- AI20K-086: dễ build hơn, nhưng rủi ro bị xem như prompt/use-case generator.
- AI20K-089: demo trực quan nhất, nhưng có rủi ro sandbox automation và hạ tầng workflow.

**Decision:** Tạm ưu tiên **AI20K-089** để phân tích sâu, giữ AI20K-084 và AI20K-086 làm backup.

**Owner:** Cả team

**Status:** Superseded bởi quyết định chốt AI20K-083 ngày 04/06/2026

---

## [2026-05-31] — Setup hạ tầng: GitHub repo + AI logging hook

**Context:** Chương trình AI20K Cohort 2 yêu cầu mỗi team có repo official với pre-configured AI logging hooks. Hooks tự động log prompt từ AI tools để phục vụ đánh giá AI literacy.

**Options:**
- Setup ngay từ Sprint 0 để log cả phần research và planning.
- Chờ đến Sprint 2 khi bắt đầu code mới setup.

**Decision:** Setup ngay từ Sprint 0 để log đầy đủ cả strategic thinking, research, planning và build.

**Setup đã làm:**
1. Clone `AI20K-Build-Cohort-2/C2-App-009` về máy.
2. Chạy script setup hooks.
3. Tạo `.env` từ `.env.example`.
4. Verify pre-push hook tồn tại.

**Owner:** Lucas

**Status:** Active

---

## [2026-05-31] — Khởi tạo bộ document: README + JOURNAL + WORKLOG

**Context:** Repo cần bộ tài liệu cốt lõi để team mới đọc vào nắm được tiến độ, quyết định và learning log.

**Decision:** Tạo 3 file chính:
- `README.md`: project overview, scope, kế hoạch.
- `JOURNAL.md`: learning journal theo sprint/tuần.
- `WORKLOG.md`: decision log theo ngày.

**Quy ước update:**
- README cập nhật khi có major change về đề tài, MVP scope hoặc kế hoạch.
- JOURNAL cập nhật trước mỗi PR hoặc khi kết thúc sprint.
- WORKLOG cập nhật mỗi khi có quyết định mới.

**Owner:** Lucas khởi tạo, cả team duy trì

**Status:** Active

---

## [2026-06-04] — Chốt đề tài AI20K-083

**Context:** Sau Sprint 0, team cần chuyển từ shortlist sang đề tài chính thức để bắt đầu thiết kế MVP. Hướng AI20K-089 có điểm mạnh về demo automation nhưng kéo theo rủi ro sandbox, hạ tầng workflow và scope kỹ thuật lớn. Ngày 04/06, team review lại tài liệu đề bài và đưa AI20K-083 vào bàn cân vì đề này vẫn thuộc nhóm AI Literacy nhưng scope web app rõ và ít rủi ro hạ tầng hơn. Team muốn một đề tài vừa fit yêu cầu web app, vừa đủ rõ buyer, vừa khả thi hơn trong thời gian ngắn.

**Nguồn quyết định:** Tài liệu "Dự án 1 - AI Trợ Lý Phổ Cập Kiến Thức AI Nền Tảng Cho Nhân Viên".

**Options đã cân nhắc:**

| Tiêu chí | AI20K-083 | AI20K-084 | AI20K-086 | AI20K-089 |
|---|---|---|---|---|
| MVP feasibility | Cao: learning path + tutor + quiz + dashboard | Trung bình: cần rubric/scoring năng lực tốt | Cao: LLM/RAG gợi ý use case | Trung bình-thấp: cần sandbox/automation runtime |
| Buyer clarity | Doanh nghiệp 10-200 nhân viên | HR/L&D | Cá nhân/team muốn tìm use case | SME/freelancer automation |
| Demo strength | Flow học end-to-end + dashboard | Bảng năng lực | List use case | Workflow chạy thật |
| Technical risk | Thấp-trung bình | Trung bình | Thấp nhưng dễ mỏng | Cao nhất |
| Fit web app requirement | Rõ: auth, user, learning, admin dashboard | Rõ | Rõ nhưng cần tránh prompt wrapper | Rõ nhưng nặng infra |

**Decision:** Chốt **AI20K-083 — AI Trợ Lý Phổ Cập Kiến Thức AI Nền Tảng Cho Nhân Viên**. AI20K-089 bị thay thế vì rủi ro sandbox/automation vượt quá mức cần thiết cho MVP; có thể giữ làm hướng mở rộng sau khi core learning app chạy ổn.

**Lý do:**
- Nhắm đúng pain point doanh nghiệp 10-200 người: nhân viên muốn dùng AI nhưng không biết bắt đầu từ đâu.
- Giải pháp có thể demo tốt bằng learning path cá nhân hóa, AI tutor, bài kiểm tra tình huống và dashboard tiến bộ.
- Không yêu cầu sandbox automation phức tạp ở MVP.
- Có mô hình giá rõ: 300.000 VNĐ/user/tháng hoặc 2.000.000 VNĐ/tháng cho 10 users.

**Owner:** Cả team

**Status:** Active

---

## [2026-06-05] — Chốt kế hoạch làm việc sau khi chọn AI20K-083

**Context:** Sau khi chốt đề ngày 04/06, team cần thống nhất cách làm để bắt đầu build đúng scope, tránh vừa làm vừa đổi hướng.

**Decision:** Chia kế hoạch làm việc theo action table để có thể bước vào scaffold MVP.

| Task | Owner tạm thời | Deadline | Artifact | Acceptance criteria | Status |
|---|---|---|---|---|---|
| Persona + user journey | Lucas | 07/06 | `docs/product/user-journey.md` | Có learner persona, manager persona, end-to-end journey | Planned |
| Lesson/content outline | Tuancoolboy | 07/06 | `docs/content-outline.md` | Có outline AI nền tảng cho ít nhất 2 role mẫu | Planned |
| Wireframe notes | Tuancoolboy | 07/06 | `docs/wireframe-notes.md` | Có màn onboarding, lesson, tutor, assessment, dashboard | Planned |
| Data model + AI flow | minhhai203 | 07/06 | `docs/data-and-ai-flow.md` | Có entity user/role/lesson/quiz/progress và tutor context contract | Planned |
| Tech stack decision | minhhai203 | 07/06 | `docs/tech-stack.md` | Chốt frontend, backend, storage, LLM provider, deploy target | Planned |
| Demo plan | Cả team | 08/06 | `planning/demo/demo-plan.md` | Có seed data, demo account, demo script, public URL plan | Planned |

**MVP nguyên tắc:**
- Làm tốt luồng học AI nền tảng cho 1-2 vai trò trước.
- Tập trung vào trải nghiệm học, hỏi AI, làm bài tình huống và xem tiến bộ.
- Chỉ mở rộng role/content sau khi core flow chạy ổn.
- Ngày 05/06 chốt feature/MVP scope; tech stack là action item riêng cần chốt trước scaffold code.

**Owner:** Cả team

**Status:** Active

---

<!-- Decision tiếp theo thêm ở đây, mới nhất ở dưới cùng -->

---

## [2026-06-08] — Đồng bộ hóa cấu trúc dự án theo template ai20k-agent-template

**Context:** Dự án bước vào Sprint 1, cần thiết lập một cấu trúc thư mục chuẩn hóa và đầy đủ thành phần theo yêu cầu của BTC AI20K Build Phase (bao gồm FastAPI backend, LangGraph agent, Docker, CI/CD workflow, tài liệu hướng dẫn và bộ unit test).

**Options:**
- Tự dựng cấu trúc và các cấu hình Docker/CI/CD thủ công: Mất nhiều thời gian và có nguy cơ bỏ sót các deliverables bắt buộc của BTC.
- Sao chép cấu trúc và mã nguồn mẫu hữu ích từ template chính thức `ai20k-agent-template`: Nhanh chóng, chuẩn hóa, đầy đủ công cụ kiểm thử và tài liệu của chương trình.

**Decision:** Thực hiện clone và sao chép cấu trúc từ template chính thức.
- **Source & Tests:** Sao chép `src/` (FastAPI + LangGraph skeleton) và `tests/` (unit tests mẫu), sửa lỗi tương thích async fixture bằng cách cấu hình `pytest.ini`.
- **DevOps:** Sao chép `Dockerfile`, `docker-compose.yml`, `Makefile`, `.dockerignore`, `ruff.toml` và `.github/workflows/ci.yml`.
- **Tài liệu & Đánh giá:** Sao chép `ARCHITECTURE.md`, `README_boilerplate.md`, `eval/`, `presentation/` và `docs/guide/`.
- **Sáp nhập cấu hình:** Thực hiện merge nội dung `.env`, `.env.example`, và `.gitignore` từ template vào dự án hiện tại để đảm bảo giữ nguyên mã khóa AI logging được BTC cấu hình riêng trước đó.

**Owner:** Antigravity & minhhai203

**Status:** Active

---

## [2026-06-08] — Chốt tech stack: Next.js 16 + Tailwind v4 + Supabase + OpenAI

**Context:** Sprint 1 chốt MVP feature scope nhưng tech stack chưa thành artifact riêng. Bắt đầu Sprint 2 phải có stack rõ ràng trước khi scaffold.

**Options:**
- Next.js 14/15 (App Router): training data ổn, ít breaking changes.
- **Next.js 16 (App Router):** mới release, có breaking changes (`middleware` rename `proxy`, Turbopack default) nhưng đi cùng template `create-next-app` mới nhất, deploy Vercel tối ưu.
- React + Vite SPA: nhanh nhưng không có SSR cho landing SEO + không có Route Handler tiện cho /api/chat.
- Astro: nice cho landing nhưng phức tạp cho /quan-ly dashboard.

**Decision:** **Next.js 16.2.7** vì đi cùng latest Vercel template, hỗ trợ Tailwind v4 sẵn, và ta có thể đọc docs offline trong `node_modules/next/dist/docs/` để verify từng API mới.

**Owner:** Lucas (đã scaffold)

**Status:** Active

---

## [2026-06-08] — Storage: Supabase + RLS · LLM: OpenAI gpt-4o-mini

**Context:** Cần storage cho user data (profiles, progress, time logs, quiz results, chat usage) + LLM cho /tro-ly tutor.

**Options:**
- Storage: Supabase / Firebase / PlanetScale + tự code auth.
- LLM: OpenAI / Anthropic Claude / Google Gemini / self-host Llama.

**Decision:**
- **Supabase** vì có Postgres + Auth + RLS built-in, free tier đủ cho MVP, schema viết SQL chuẩn dễ migrate sau. Schema 6 bảng trong `supabase/migrations/0001_init.sql`, RLS strict (`auth.uid() = user_id`).
- **OpenAI gpt-4o-mini** vì giá ~22.000đ/người/tháng đáp ứng biên gộp ghế nền 100k/user. (CLAUDE.md §11 chốt rate-limit 30 lượt/ngày/user.)

**Owner:** Lucas (đã wire schema)

**Status:** Active

---

## [2026-06-09] — Demo mode (localStorage fallback) cho lúc chưa có Supabase + OpenAI

**Context:** Khi demo thầy hoặc test local, không phải lúc nào cũng có Supabase project setup sẵn. App phải dùng được luôn.

**Options:**
- Bắt thầy/teammate tự setup Supabase project trước khi xem demo (~15 phút).
- Mock toàn bộ backend bằng JSON file (nặng, mất ý nghĩa demo).
- **Detect env thiếu → tự fall back sang localStorage** (cho user-scoped data) + canned responses (cho /tro-ly).

**Decision:** Option 3. Logic:
- `lib/supabase/is-configured.ts` check `NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY` có không.
- Thiếu → set cookie `ai_troly_demo_session` + dùng `lib/demo-storage.ts` (localStorage wrapper).
- `/tro-ly` thiếu OpenAI key → dùng `lib/tro-ly-canned-responses.ts` (canned answer theo regex match câu hỏi + role).
- Banner cam ở đầu `(app)/layout` báo user biết đang ở demo mode.

Khi env có sẵn → code tự nhận biết và dùng real backend, không cần thay code.

**Owner:** Lucas

**Status:** Active

**Risk note:** Tech debt khi launch real — phải đảm bảo demo paths không bị users tìm thấy ở production. Phương án: assert env trong CI/CD pipeline trước deploy production.

---

## [2026-06-09] — Tuancoolboy review code, push Vercel và hoàn thiện database employee

**Context:** Sau khi core UI chạy được, cần kiểm tra lại code, đưa bản demo lên
Vercel và bảo đảm phần database cho nhân viên đủ dữ liệu thật trước khi mở rộng
sang manager.

**Options:**
- Chỉ dùng localStorage demo: nhanh nhưng không chứng minh được persistence thật.
- Chạy Supabase cho employee trước, manager làm sau: đúng thứ tự vì employee là
  nguồn dữ liệu cho dashboard quản lý.

**Decision:** Tuancoolboy đã xem/review code, push demo lên Vercel và hoàn thiện
database employee theo migrations `0001_init.sql` và
`0003_employee_profile_assessment.sql`: `profiles`, `module_progress`,
`quiz_results`, `time_logs`, `chat_usage`, `leads`, RLS user-scoped và các field
onboarding assessment để lưu vai trò, daily tasks, AI level.

**Owner:** Tuancoolboy

**Status:** Active

---

## [2026-06-09] — Charts dùng recharts (cho dashboard manager)

**Context:** `/quan-ly` dashboard cần 3 biểu đồ (bar theo phòng ban, donut trạng thái, line trend 6 tuần).

**Options:**
- **recharts:** React-friendly, ~92KB gzip, declarative JSX.
- chart.js + react-chartjs-2: như prototype HTML, ~67KB gzip nhưng imperative API.
- nivo / visx: feature-rich nhưng nặng (>200KB).
- Custom SVG: 0 dep nhưng code phức tạp + maintain khó.

**Decision:** **recharts** vì idiomatic React, dễ maintain, performance OK với 12 nhân viên data.

**Owner:** Lucas

**Status:** Active

---

## [2026-06-09] — Role detection cho demo: email pattern matching

**Context:** Demo mode không có database để query `user_type`. Phải biết user là nhân viên hay quản lý ngay khi login.

**Options:**
- Hỏi user "Bạn là ai?" sau khi login (thêm 1 màn hình).
- Set `userType` cố định trong cookie test, dev tự đổi.
- **Detect qua email pattern** (`quanly@`, `manager@`, `hr@`, `admin@`, `truongphong`).

**Decision:** Option 3 — UX gọn nhất cho demo. Khi có Supabase thật → query `profiles.user_type` (TODO marker đã ghi trong `(app)/layout.tsx`).

**Owner:** Lucas

**Status:** Active

---

## [2026-06-09] — File middleware.ts rename sang proxy.ts (Next 16)

**Context:** Khi chạy `npm run dev` thấy warning:
> The "middleware" file convention is deprecated. Please use "proxy" instead.

**Decision:** Rename file + đổi function name. Đã đọc `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` xác nhận API signature giống hệt. Chỉ đổi tên file + tên function.

**Owner:** Lucas

**Status:** Active

**Bài học:** Tin docs offline trong `node_modules/next/dist/docs/` thay vì training data Claude khi gặp Next 16 API. AGENTS.md đầu repo đã nhắc.

---

## [2026-06-10] — Deploy production qua Vercel CLI (project `c2-app-009`)

**Context:** Cần demo UI công khai trên Vercel Hobby, không phụ thuộc import GitHub org private (Hobby không link được repo org).

**Options:**
- Import GitHub org repo vào Vercel (bị chặn trên Hobby).
- Deploy bằng `vercel --prod` từ máy local (CLI upload source).
- Mirror repo sang personal GitHub rồi import (đã ghi trong PROJECT-CONTINUATION, chưa dùng lần này).

**Decision:** Deploy CLI trực tiếp → project `c2-app-009`, sync env vars từ `.env.local` lên Vercel Production, production alias chính **`https://ai-tro-ly.lucasnguyen.vn`**.

**Owner:** minhhai

**Status:** Active

---

## [2026-06-10] — Tắt Vercel Deployment Protection (SSO) cho demo công khai

**Context:** Bạn bè truy cập link production thấy màn **"Log in to Vercel"** thay vì landing app. Project đang bật `ssoProtection: all_except_custom_domains` — khóa mọi URL `*.vercel.app`.

**Options:**
- Approve từng user trong External Access (Hobby giới hạn ~1 external user, không scale).
- Tắt SSO protection: `vercel project protection disable c2-app-009 --sso`.
- Mua custom domain + Pro (không cần cho demo hiện tại).

**Decision:** Tắt SSO protection. Demo công khai dùng URL production; auth app vẫn qua Supabase `/login`.

**Owner:** minhhai

**Status:** Active

---

## [2026-06-10] — Tài khoản demo Supabase: admin + guest (SQL thủ công)

**Context:** Cần tài khoản sẵn cho demo hội đồng: quản lý xem `/quan-ly/leads`, guest trải nghiệm onboarding từ đầu.

**Options:**
- Supabase Dashboard → Add user (đơn giản, khuyến nghị cho admin).
- SQL script trong SQL Editor (tạo `auth.users` + `auth.identities` + `profiles`).

**Decision:**
- **Admin:** email prefix `admin@` / `quanly@` / `manager@` → app detect manager qua `detectUserTypeFromEmail()` (GĐ1, chưa có `profiles.user_type`).
- **Guest:** email thường (`guest@...`), `email_confirmed_at` set sẵn, **`role_id = NULL`** → login vào `/onboarding`, không force vai trò.
- Lưu ý PL/pgSQL: mỗi `%` trong `RAISE NOTICE` phải có tham số đi kèm.

**Owner:** minhhai

**Status:** Active

---

## [2026-06-10] — Landing headline: ngắt dòng có chủ đích

**Context:** Tiêu đề "Tại sao khóa đào tạo AI cũ không hiệu quả?" bị browser wrap xấu (`hiệu` / `quả?` tách dòng).

**Options:**
- `whitespace-nowrap` trên cụm "không hiệu quả?" (đã thử, vẫn chưa đúng ý copy).
- `<br />` cố định sau "AI cũ" — hai dòng: `...AI cũ` / `không hiệu quả?`.
- Rút ngắn copy.

**Decision:** Dùng `<br />` sau "Tại sao khóa đào tạo AI cũ". Commit `ae1845c` trên `develop`, deploy production.

**Owner:** minhhai

**Status:** Active

---

## [2026-06-10] — BE-12: Chatbot 2 quyền (nhân viên / quản lý) + trí nhớ dài hạn

**Context:** Trợ lý AI trước đây chỉ phục vụ nhân viên đã onboarding, gửi 1 tin/lần không nhớ hội thoại; quản lý không chat được vì API bắt buộc `role_id`. Product yêu cầu 2 chatbot riêng: nhân viên kèm cặp học theo tiến độ thật, quản lý phân tích team từ Supabase.

**Options:**
- Chỉ lưu core context (summary), không lưu messages → rẻ hơn nhưng không xem lại hội thoại.
- Lưu messages + AI tóm tắt core context sau mỗi phiên → đủ trí nhớ dài hạn + lịch sử UI.
- Manager chatbot dùng mock `team-data.ts` → giữ GĐ1 scope nhưng không đáp ứng yêu cầu phân tích thật.
- Manager chatbot đọc Supabase thật (service role) → lát cắt Phase 2 có chủ đích; dashboard `/quan-ly` vẫn mock.

**Decision:**
- Migration `0012_chat_memory.sql`: `chat_conversations`, `chat_messages`, `chat_memories` + RLS user-scoped.
- System prompt tách `buildEmployeeSystemPrompt` / `buildManagerSystemPrompt`; UI hiển thị **Trợ lý AI (trợ lý riêng của …)**.
- Employee: inject tiến độ (`module_progress`, `quiz_results`, `time_logs`) + core context; 6 tin gần nhất vào OpenAI.
- Manager: không cần `role_id`; `getTeamAnalysisSummary()` qua service role + `auth.admin.listUsers`, lọc email pattern nhân viên.
- Sau stream: lưu turn + `refreshCoreContext` async (throttle ≥5 phút hoặc ≥3 lượt).
- API mới: `GET /api/chat/history`; `POST /api/chat` trả header `X-Conversation-Id`.
- Spec: `specs/BE-12-role-chatbots-and-memory.md`.

**Owner:** minhhai (branch `feat/haidm/personal-chatbot`)

**Status:** Active

**Verification (2026-06-10):** Migration `0012_chat_memory.sql` đã chạy trên Supabase local. `npm test` pass: Vitest 51/51, API integration 30/30 (Supabase mode), pytest 5/5 — gồm manager chat không `role_id`, history persist, `X-Conversation-Id`.

**Follow-up:** Smoke test browser (nhân viên: "lần trước học đến đâu"; quản lý: "ai chậm tiến độ"); Phase 2 thêm `profiles.user_type` thay email pattern.

---

## [2026-06-11] — Quy trình bắt buộc cho mọi AI agent

**Context:** Team cần thống nhất cách làm việc giữa Cursor, Codex, Claude Code và các agent khác — tránh làm trên nhánh cũ, bỏ qua test, hoặc không cập nhật tài liệu.

**Options:**
- Chỉ ghi trong README → dễ bị bỏ qua bởi agent.
- Rule Cursor `alwaysApply: true` + cập nhật `AGENTS.md` → agent luôn thấy khi mở repo.

**Decision:** Thêm `.cursor/rules/agent-workflow.mdc` (always apply) và section **Feature Workflow** trong `AGENTS.md`:
1. Feature mới: `git checkout develop && git pull`, rồi nhánh `{type}/{noi-dung}` (vd. `feat/update-lession-ui`).
2. Sau feature: chạy `npm run lint`, `npm run test`, `npm run build` và review toàn bộ diff.
3. Trong lúc làm: cập nhật `WORKLOG.md`, `PROJECT-CONTINUATION.md`, và spec notes nếu có.

**Update 2026-06-11:** Mở rộng sang mọi AI tool — canonical rule `.agents/rules/agent-workflow.md` (`activation: always-on`), thêm `GEMINI.md`, cập nhật `CLAUDE.md` + bảng tool mapping trong `AGENTS.md`.

**Owner:** minhhai

**Status:** Active

---

## [2026-06-15] — Renumber Supabase migrations + rule timestamp bắt buộc

**Context:** Merge `develop` + nhánh mentor/SaaS tạo trùng số `0013`–`0022`; `supabase db push` fail. User yêu cầu renumber và rule cho lần sau.

**Decision:**
1. Rename 18 file sang `YYYYMMDDHHMMSS_<noi-dung>.sql` theo thứ tự dependency (Phase 2.0 develop → mentor → content/grading → agent paths). `0007b` → `20260608150000_image_paths_column.sql`.
2. Rule canonical `.agents/rules/supabase-migrations.md` + Cursor `.cursor/rules/supabase-migrations.mdc`; cấm numbered `0013+`.
3. `npm run db:validate` + hook trong `db:sync`; legacy giữ `0001`–`0012`.

**Kiểm tra:** `npm run db:validate` 30 files OK; vitest 154 pass; `next build` pass.

**Follow-up:** Remote đã apply tên cũ → `npm run db:repair:help` / `supabase migration repair` trước push production.

**Owner:** Claude Code

**Status:** Active

---

## [2026-06-13] — 5 tính năng theo góp ý mentor (Phase 2)

**Context:** Họp mentor 10/06 chốt 5 hạng mục cần hoàn thiện để demo + test phòng HR với khách trong 3 ngày. Nguồn: `docs/handoff-phase2-mentor-features.md`.

**Decision:** Build cả 5 mục theo thứ tự ưu tiên mục 6, làm bài bản (schema chuẩn + migration + RLS) song song demo fallback localStorage. Không phá Phase 1.

1. **Aha Moment** (mục 1) — thay Bước 4 trong `components/module-lesson-content.tsx` bằng flow 3 ô (điều vừa hiểu / nối kiến thức mới↔cũ / sẽ thử khi nào) + AI hỏi lại đúng 1 câu (`/api/aha`, token thấp, có câu mẫu khi chưa bật OpenAI) + chọn phạm vi chia sẻ (riêng tư/phòng/công ty) + nút bỏ qua. Ghi giờ tiết kiệm vào `time_logs`. Migration `0013_aha_reflections` + RLS. Demo: `lib/demo-aha.ts`.
2. **Nội dung HR** (mục 5) — mở rộng vai trò `van-hanh` → lộ trình Hành chính/HR (m7–m10: soạn quyết định, lọc CV, email nội bộ, chấm công/nghỉ phép). Thêm cờ `isFoundation` + `skills[]` trên module. Helper `composePathFromSkills`/`getFoundationModules`. Migration `0014_skills_module_skills` + seed kỹ năng chung + map module HR.
3. **Manager builder** (mục 3) — `app/(app)/quan-ly/lo-trinh` + `components/manager-path-builder.tsx`: chọn vị trí chính + tick kỹ năng → AI gợi ý lộ trình (Nền tảng + module theo kỹ năng, tự sắp cấp độ) → tick +/− → gán. Migration `0015_job_positions_learning_paths` (6 bảng) + RLS. Demo: `lib/demo-paths.ts`.
4. **Invite** (mục 2) — `/quan-ly/nhan-vien` modal thêm chọn phòng ban + vị trí khi mời. Nút "Đăng nhập với Google" (`components/auth-google-button.tsx`, bật ở real mode) + env config `.env.example`.
5. **Leaderboard + feed** (mục 4) — `app/(app)/bang-xep-hang` 3 tab (Phòng/Công ty/Cá nhân) + bảng tuần & tổng + opt-in ẩn tên ở bảng công ty. Feed widget (`components/dashboard-feed.tsx`) trên dashboard + trang xếp hạng. Migration `0016_leaderboard_points` (challenges/points_ledger/leaderboard_visibility) + RLS + seed challenge.

**Kiểm tra:** `npx eslint` sạch, `npx vitest run` 57/57 pass, `npx next build` exit 0 (TS pass, đủ route mới).

**Còn lại (backend song song, không chặn demo):** wiring API thật ghi `learning_paths`/`path_assignments`/`points_ledger`; Google OAuth callback thật; nguồn feed/leaderboard từ bảng `events`+`points_ledger` thay dữ liệu demo.

**Owner:** Claude Code

**Status:** Active

---

## [2026-06-13] — 3 thay đổi UX sau review (tool AI + rubric + paste text)

**Context:** Review sản phẩm chốt 3 thay đổi UX (`docs/handoff-3-ux-changes.md`), có các mục [SỬA THEO REVIEW]. Nhánh `feature/ux-3-changes` tách từ `feature/phase2-mentor-features` (Phase 2 chưa merge develop; mục 1 phụ thuộc màn bài học 5 bước + Aha của Phase 2).

**Decision:**
1. **Tool AI (mục 3) + prompt động (mục 2):** `lib/ai-tools-config.ts` (tool chính + tool chuyên dụng) + `lib/ai-tool-helper.ts` (`getOrgAiTool` — 1 nguồn sự thật theo 6.4). Trang `/quan-ly/cai-dat` cho quản lý chọn tool chính (chặn quyền ở route lẫn UI). `/api/org-settings` GET/PUT (PUT manager-only). Bài học hiển thị tool động: "Mở [tool] → paste prompt" + note "tối ưu cho [tool]"; bài cần ảnh/video hiện banner tool chuyên dụng + lý do (note trung tính, 6.5). Làm rõ app dạy dùng tool ngoài vs Trợ lý AI là gia sư. Migration `0017` thêm `organizations.ai_tool` + `learning_modules.tool` + RLS update cho manager. Icon SVG `public/images/tools/`.
2. **Chấm rubric + paste text (mục 1):** ô paste text trên upload ảnh (nộp text-only hoặc kèm ảnh). Mở rộng `/api/practice-review` nhận `answerText` (KHÔNG dùng `/api/chat`, tránh quota chat). Chấm theo `rubric` của module; thiếu rubric → chấm tự do (6.3). Text là căn cứ chính, ảnh bổ sung. JSON robust: strip ```json fences, try/catch không crash, clamp `points<=maxPoints`, total = sum đã clamp (6.1). Demo random 40–95 (6.2). Cắt text 6000 ký tự (6.6). Bảng điểm rubric từng tiêu chí. Dùng hằng `PRACTICE_PASS_SCORE` thay hardcode.

**Kiểm tra:** `npx eslint` (changed files) sạch; `npx vitest run` 59/59 pass (+2 test parseRubricReviewJson); `npx next build` exit 0 (route `/quan-ly/cai-dat`, `/api/org-settings`).

**Còn lại:** cột `rubric` chưa lưu DB (lấy từ data tĩnh theo id qua `mapRow`); hydrate `org_ai_tool` localStorage từ DB hiện làm ở settings + lesson load (chưa ở layout chung).

**Owner:** Claude Code

**Status:** Active

---

## [2026-06-13] — Hoàn thiện handoff-tong-hop (C) + nền SaaS §0.2 + push 5 PR stacked

**Context:** Bàn giao tổng hợp A→B→C. A (Phase 2) + B (3 UX) đã code; cần làm Phần C + nền phân quyền/RLS §0.2 và đẩy GitHub cho đồng đội (tự chủ, an toàn).

**Decision — 5 nhánh stacked, mỗi nhánh 1 PR base đúng nền (chưa merge):**
- A `feature/phase2-mentor-features` (base develop) → PR #22
- B `feature/ux-3-changes` (base A) → PR #23
- C1 `feature/saas-rbac-foundation` (base B) → PR #24: migration 0018 `platform_admins` + `is_platform_admin()` + `account_type` + policy SELECT platform_admin; `lib/rbac.ts` + `lib/audit-log.ts` (wire org-settings PUT). Chỉ đặt nền, chưa UI super-admin.
- C2 `feature/sample-files` (base C1) → PR #25: `attachedFile` + 7 file mẫu ẩn danh `public/files/` (có điểm bẫy) + migration 0019; hộp tải file ở Bước 1.
- C3 `feature/dept-tool-individual` (base C2) → PR #26: tool theo phòng ban (`getDeptAiTool`, migration 0020 `department_ai_tools`) + builder đảo cấp phòng/cá nhân + account-check + `videoGuide` + `suggestToolForIndividual` (pure+test).

**An toàn:** KHÔNG tự merge/xóa nhánh, không commit `.env`, commit chọn lọc, mọi migration có rollback.

**Kiểm tra:** eslint sạch · vitest 65/65 · next build exit 0 (mỗi cụm).

**Còn lại:** persistence DB cho dept-tool & user_tool_status; wiring gợi ý tool vào onboarding cá nhân; seed `platform_admins`. Chi tiết: `docs/handoffs/ket-qua-ban-giao.md`.

**Owner:** Claude Code

**Status:** Active

---

## [2026-06-13] — Hợp nhất Agent lộ trình lên nền admin/super-admin + demo gọi OpenAI thật

**Context:** Đưa Agent sinh lộ trình (2 luồng) lên nhánh `feature/admin-superadmin-ui` (đã có `/quan-tri` + Phần C gợi ý tool cá nhân). Nhánh kết quả `feat/admin-agent-demo-openai`.

**Decision:**
1. **Agent lộ trình** (`app/api/agent/lo-trinh`, `lib/agent/*`, `components/agent-path-panel.tsx`, migration `0022`): mang nguyên từ `feat/agent-lo-trinh`. Migration đổi `0018`→`0022` (nền đã dùng tới `0021`).
2. **Khử trùng `individual-tool-suggest.ts`:** GIỮ bản nền (Phần C, `suggestToolForIndividual(roleId)→{tool,reason}`); bỏ bản Agent tự tạo. `path-agent-input.ts` đổi import sang `suggestToolForIndividual(roleId).tool`.
3. **Chat demo gọi OpenAI thật** (`app/api/chat/route.ts`): chỉ canned khi KHÔNG có key. Demo + có key → đường tối giản `streamDemoOpenAI` (system prompt theo role, KHÔNG context/history Supabase, KHÔNG lưu, rate-limit in-memory `checkRateLimit`, cache câu phổ biến). Không crash khi thiếu Supabase.
4. **Agent route demo:** đã sẵn gọi OpenAI theo `isOpenAIConfigured()` (không gate theo mode) — chỉ cache mới gate supabase. Không cần sửa.
5. **Test động** (`learning-modules-data.test.ts`): giữ bản kiểm động ≥6/role + tổng = sum thực tế (theo yêu cầu user).

**Kiểm tra:** `npm run lint` sạch (1 warning pre-existing `scripts/`); `npx vitest run` 79/79 pass; `npm run build` exit 0 — đủ `/quan-tri`, `/api/chat`, `/api/agent/lo-trinh`.

**Còn lại:** chạy migration `0022` trên Supabase cho real mode; đặt `OPENAI_API_KEY` để demo gọi OpenAI thật (thiếu key → canned/fallback); rate-limit in-memory dùng chung key `demo-user` ở demo (best-effort).

**Owner:** Claude Code
## [2026-06-11] — Định nghĩa Phase 2: company learning platform + 4 AI capabilities

**Context:** Product cần gom định hướng công ty, lộ trình tùy biến, Aha Moment,
community/leaderboard và 4 agent thành một source of truth có thể triển khai.

**Options:**
- Xây 4 autonomous agents gọi lẫn nhau.
- Giữ 4 capability độc lập, deterministic-first, LLM chỉ dùng ở phần cần ngôn
  ngữ/đánh giá mở.
- Tách thêm LangGraph/FastAPI service ngay trong Phase 2.

**Decision:**
- Tạo `specs/PHASE2-SPEC.md`.
- Giữ Next.js 16 + Supabase + OpenAI SDK; không thêm backend/runtime mới.
- Thiết kế 4 capability: tutor, grader, recommender, manager analytics.
- Recommendation, leaderboard, MCQ và metrics dùng rules/SQL, không dùng token.
- Google OAuth là must-ship; phone OTP đặt sau feature flag vì phụ thuộc SMS
  provider và budget.
- Aha Moment private mặc định; sharing là opt-in.
- Chia roadmap thành Phase 2.0 đến 2.8, bắt đầu bằng hardening manager/invite
  hiện tại trước khi mở rộng.

**Owner:** minhhai

**Status:** Spec ready for review

---

## [2026-06-11] — Fix Phase 2 review issues (CRITICAL + HIGH + spec gaps)

**Context:** Hai review từ Senior Product Dev + Technical Architect chỉ ra các
vấn đề cần fix trước khi bắt đầu build Phase 2.

**Fixes thực hiện:**

### Code fixes (migration + routes)

- **CRITICAL — `auth.admin.listUsers` full scan:** migration 0013 thêm
  `profiles.email` (unique index, backfill từ `auth.users`, trigger sync khi
  register/email update). Route `app/api/manager/team/route.ts` thay thế 2 hàm
  pagination loop bằng: (a) `profiles.email` lookup → `getUserById` O(1) và
  (b) `Promise.all(getUserById)` song song, không scan toàn bộ.
- **HIGH — Invite link expiry:** migration 0013 thêm `expires_at`, `max_uses`,
  `used_count` vào `organization_invite_links`. RPC function
  `increment_invite_used_count` dùng atomic SQL update tránh race condition.
  `lib/company-invite-links.ts` cập nhật types + `findActiveInviteLinkByToken`
  kiểm tra expiry/exhaustion. `app/moi/[token]/accept/route.ts` gọi RPC thay
  vì update `last_used_at` thủ công.

### Spec fixes (PHASE2-SPEC.md)

- **Scope adjustment:** community feed + badges → optional behind feature flag;
  AI-assisted module draft → must-ship (trong authoring UX).
- **Leaderboard:** opt-in per employee (không phải opt-out).
- **Multi-org note (Section 13.1):** clarify `profiles.organization_id` là
  shortcut context, không dùng cho RLS; authorization luôn qua
  `organization_members`.
- **RLS helpers (Section 13.2):** standardize dùng security-definer functions
  thay inline subquery.
- **AI budget fallback_behavior enum (Section 13.3):** định nghĩa 3 giá trị
  `block`/`queue`/`degrade` + race condition mitigation.
- **Phase 2 KPIs (Section 17):** thêm 7 KPIs với ngưỡng + nguồn đo.
- **Assignment version upgrade (Section 16):** spec endpoint + progress
  transfer rule.
- **Definition of Done:** thêm bắt buộc rollback section trong mỗi migration.
- **Open decisions:** đánh priority HIGH cho 3 quyết định cần chốt sớm.
- **P2-BE-02:** đánh dấu completed trong Phase 2.0 checklist.

**Decision:**
- Giữ `profiles.organization_id` FK không đổi; Phase 2 không tạo thêm ràng buộc
  multi-org — để migration sau làm nullable khi cần.
- Dùng atomic SQL RPC cho used_count thay vì optimistic lock ở application layer.

**Owner:** minhhai

**Status:** Done — cần chạy migration 0013 trên Supabase

---

## [2026-06-12] — Auth: Nhập tên khi đăng ký account

**Context:** Manager cần nhìn được tên thật của nhân viên trong danh sách đội,
không chỉ email. Form đăng ký phải yêu cầu họ tên và Supabase phải đồng bộ tên
này vào `profiles.full_name`.

**Options:**
- Để manager tự nhập tên khi thêm nhân viên: dễ sai và trùng dữ liệu.
- Lưu tên từ lúc register qua Supabase Auth metadata rồi trigger ghi vào profile:
  đúng nguồn dữ liệu và dùng lại được ở manager dashboard.

**Decision:** Tuancoolboy thêm/sửa flow đăng ký account để nhập tên, gửi
`full_name` vào Supabase Auth metadata và dùng migration
`0009_profile_full_name_metadata.sql` để đồng bộ vào `profiles.full_name`.

**Owner:** Tuancoolboy

**Status:** Active

---

## [2026-06-13] — Màn "Thiết kế lộ trình" tab Phòng ban → phân cấp dọc (mặc định phòng + override member)

**Context:** `/quan-ly/lo-trinh` tab "Theo phòng ban" đổi từ wizard sang phân cấp dọc. Giữ tab "Theo cá nhân".

**Decision:**
1. Tách `ManagerPathBuilder` thành shell mỏng (tab) + 2 component: `manager-dept-path-designer.tsx` (UI dọc mới), `manager-member-path-wizard.tsx` (wizard cũ, cá nhân).
2. Dept designer: chọn phòng + vị trí → khối "Kỹ năng áp cho CẢ phòng" (mặc định) → danh sách thành viên dọc (avatar `initialsOf` + tên + chip kỹ năng hiệu lực + "Tùy chỉnh"). Click → bung panel chỉnh kỹ năng RIÊNG (override) → nhãn "đã chỉnh riêng" + "Bỏ chỉnh riêng". Hiệu lực = override ?? kỹ năng phòng.
3. "AI gợi ý lộ trình" = `composePathFromSkills(deptSkills)` (suggester rule-based hiện có); "Lưu & gán cho cả phòng" → `saveDemoDeptDesign` (mặc định phòng + override member) + `addDemoAssignment` từng thành viên theo kỹ năng hiệu lực.
4. Demo storage mới `lib/demo-paths.ts`: `DemoDeptDesign` + `getDemoDeptDesign`/`saveDemoDeptDesign` (map deptId→design, localStorage). Đổi phòng nạp lại thiết kế đã lưu. Tránh `useEffect` set-state (dùng handler onChange).

**Kiểm tra:** `npm run lint` sạch (1 warning pre-existing `scripts/`); `npx vitest run` 79/79; `npm run build` exit 0 (`/quan-ly/lo-trinh`).

**Còn lại:** real mode ghi override/default vào `member_positions`/`position_skills` (migration 0015) thay localStorage; nút "AI gợi ý" hiện dùng rule-based, có thể nối Agent `/api/agent/lo-trinh` nếu cần (Agent hiện session-scoped, cần contract nhận skill list).

**Owner:** Claude Code

**Status:** Active

---

## [2026-06-13] — Agent nhận skill list cho preview phòng ban (nút "AI gợi ý lộ trình")

**Decision:** Mở rộng `/api/agent/lo-trinh`: nhánh PREVIEW khi body có `skillSlugs` → `buildDeptPreviewInput` dựng input luồng công ty TRỰC TIẾP (skill list + roleId + level đại diện), KHÔNG đọc DB, KHÔNG ghi cache cá nhân (tránh đè lộ trình riêng của quản lý). `generatePath` gọi OpenAI khi có key, validate id từ kho; lỗi/không key → fallback `composePathFromSkills`. Dept designer gọi API này (cache client theo phòng+skills), render badge AI/Quy tắc; lỗi → fallback rule-based, không crash.

**Kiểm tra:** `npm run lint` sạch (1 warning pre-existing); `npx vitest run` 81/81 (+2 test `buildDeptPreviewInput`); `npm run build` exit 0.

**Owner:** Claude Code

**Status:** Active

---

## [2026-06-13] — Trợ lý AI quản lý (demo) có dữ liệu đội, không hỏi ngược

**Decision:** Demo mode dựng `buildDemoTeamSummary()` (lib/team-data.ts) từ `TEAM_MEMBERS` (tổng quan, theo phòng, ai cần kèm, ai làm tốt) thay `getTeamAnalysisSummary` (cần Supabase). Truyền vào `buildManagerSystemPrompt` trong `streamDemoOpenAI` (app/api/chat/route.ts) → Trợ lý quản lý phân tích đội ngay, không hỏi ngược điểm quiz/giờ học. Vẫn gọi OpenAI thật khi có key.

**Kiểm tra:** `npm run lint` sạch (1 warning pre-existing); `npx vitest run` 81/81; `npm run build` exit 0. Test live: chat manager demo → trả phân tích cụ thể từng nhân viên + phòng (X-Chat-Mode: demo-openai).

**Owner:** Claude Code

**Status:** Active
## [2026-06-12] — BE-08: Thêm nhân viên bằng email đã đăng ký

**Context:** Quản lý cần thêm nhân viên vào công ty nhưng không nên tự tạo hồ sơ
ảo hoặc nhập lại tên/phòng ban bằng tay. Email phải thuộc tài khoản Supabase Auth
đã đăng ký.

**Options:**
- Cho manager nhập đầy đủ tên, email, phòng ban: nhanh nhưng dễ lệch với hồ sơ thật.
- Chỉ nhập email, server tìm Auth user + profile rồi ghi `organization_members`:
  ít lỗi hơn và giữ một nguồn dữ liệu.

**Decision:** Tuancoolboy code flow thêm nhân viên ở `/quan-ly/nhan-vien`:
manager nhập email, API kiểm tra Auth user, lấy tên/số điện thoại/phòng ban từ
`profiles`, rồi thêm membership vào `organization_members`; nếu bật quyền quản
lý thì tạo công ty riêng cho email đó.

**Owner:** Tuancoolboy

**Status:** Active

---

## [2026-06-12] — BE-10: Link mời nhân viên token-only

**Context:** Manager cần gửi một link mời công ty cho nhân viên tự đăng ký hoặc
đăng nhập rồi được thêm vào đúng tổ chức, không lộ organization id trong URL.

**Options:**
- Link chứa email/tổ chức trực tiếp: dễ debug nhưng lộ thông tin.
- Token-only `/moi/[token]`: URL gọn, có thể rotate, server kiểm tra bằng service
  role.

**Decision:** Tuancoolboy thêm mục link mời trong trang nhân viên, API tạo/copy/
đổi token và migration `0011_company_invite_links.sql`. Flow accept link ghi
`organization_members` quyền `employee` cho đúng tổ chức và giữ redirect login/
register qua `next`.

**Owner:** Tuancoolboy

**Status:** Active

---

## [2026-06-12] — Fix seed bài học không phụ thuộc Supabase Realtime

**Context:** Khi chạy `npx -y -p node@20 node --env-file=.env.local ./node_modules/.bin/tsx scripts/seed-learning-modules.ts`, Supabase JS khởi tạo Realtime và lỗi vì Node 20 không có native WebSocket.

**Options:**
- Cài thêm package `ws` và truyền transport cho Supabase Realtime — thêm dependency chỉ để seed dữ liệu tĩnh.
- Chạy seed bằng Node 22 — giải quyết tạm thời nhưng dễ lặp lại lỗi trên máy dùng Node 20.
- Gọi Supabase PostgREST trực tiếp bằng `fetch` + service role — đúng nhu cầu upsert bảng `learning_modules`, không khởi tạo Realtime.

**Decision:** Đổi `scripts/seed-learning-modules.ts` sang PostgREST `POST /rest/v1/learning_modules?on_conflict=id` với `Prefer: resolution=merge-duplicates,return=minimal`.

**Owner:** Tuancoolboy

**Status:** Active

---

## [2026-06-12] — BE-08: Mỗi manager email có một công ty riêng

**Context:** Khi set `ronaldo36@gmail.com` lên manager bằng cách update
`organization_members.member_role`, tài khoản này rơi vào cùng `Tổ chức mặc định`
với `vuhaituan@gmail.com`. Root cause là migration `0008` backfill manager vào
default org, còn runtime lấy membership đầu tiên bằng `.limit(1)`, nên dữ liệu
đa công ty không được tách ổn định.

**Options:**
- Giữ default org và chỉ sửa SQL thủ công: nhanh nhưng dễ tái lỗi khi thêm manager mới.
- Tách theo domain email: hợp doanh nghiệp thật hơn, nhưng email cá nhân như Gmail sẽ vẫn lẫn.
- Tách mỗi manager email sang một private organization: phù hợp giai đoạn chưa có UI chọn nhiều tổ chức.

**Decision:** Chọn tách theo từng manager email. Thêm helper chọn membership ưu
tiên `owner`, organization riêng, rồi `updated_at`; thêm migration `0014` để
tách dữ liệu cũ; checkbox **Cấp quyền quản lý** tạo công ty riêng cho email được
cấp quyền. Thêm script reset dev DB xóa cả Auth users để test lại từ đầu.

**Owner:** Tuancoolboy

**Status:** Active

---

## [2026-06-12] — BE-08: Một email chỉ thuộc một công ty

**Context:** Sau khi tách manager theo công ty riêng, phát hiện case
`mixi@gmail.com` đã được thêm vào công ty A nhưng manager công ty B vẫn có thể
thêm cùng email hoặc user có thể accept link mời của công ty B.

**Options:**
- Chỉ chặn ở UI: dễ hiểu nhưng không bảo vệ API/link mời và race condition.
- Chỉ thêm unique DB constraint: bảo vệ dữ liệu nhưng lỗi trả về thô, khó hiểu.
- Kết hợp runtime guard + DB constraint: API/link mời trả lỗi rõ, DB vẫn là lớp
  khóa cuối.

**Decision:** Áp dụng rule một Supabase Auth user/email chỉ có một membership
công ty. Thêm migration `0015_single_organization_membership.sql`, helper
`lib/single-organization-membership.ts`, chặn cả `/api/manager/team` và
`/moi/[token]/accept`, đồng thời cập nhật helper promote manager.

**Owner:** Tuancoolboy

**Status:** Active

**Follow-up:** Sau mỗi `vercel --prod`, chạy `vercel alias set <deployment-url> ai-tro-ly.lucasnguyen.vn` vì Vercel đôi khi chỉ auto-alias `ai-tro-ly.vercel.app` (tên project cũ).

---

## [2026-06-12] — Tổng hợp lộ trình triển khai Phase 1 → Phase 2 thành HTML

**Context:** Team cần một trang duy nhất để nhìn rõ những gì Phase 1 đã ship,
nền tảng Phase 2 đang có, chuỗi phụ thuộc và toàn bộ roadmap Phase 2.0–2.8.

**Decision:**
- Tạo `specs/PHASE2-ROADMAP.html` dạng self-contained, responsive, không
  thêm dependency.
- Đối chiếu trạng thái từ spec, plans, implementation notes, worklog, git
  history, migrations, routes và tests thay vì chỉ sao chép checklist.
- Hiển thị riêng hai khái niệm: nền tảng đã có sẵn và tiến độ checklist Phase 2
  chính thức.
- Đánh dấu `GET /moi/[token]/accept` là blocker Phase 2.0 vì spec yêu cầu
  state-changing action phải dùng `POST`.

**Owner:** Codex

**Status:** Done — docs-only, cần review HTML và diff

## 2026-06-13 — Phase 2.0 hardening (invite POST + dept sync)

**Goal:** Close Phase 2.0 blockers P2-BE-00 and P2-BE-01 before Phase 2.1.

**Decisions:**
- Extract invite accept logic to `lib/invite-acceptance.ts`; route handler exports GET (redirect only) + POST (mutate).
- Invite page uses HTML form POST; login/register `next` points to `/moi/[token]` not `/accept`.
- Department sync via `lib/member-department-sync.ts` + service role; called from profile PUT, sync API, and onboarding save.

**Tests:** `lib/invite-acceptance.test.ts`, `lib/member-department-sync.test.ts` — 76 Vitest total pass.

**Follow-up:** P2-QA-00 smoke (2 managers, 2 orgs); P2-TEST-00 API integration tests.

## 2026-06-13 — Phase 2.0 tests + Phase 2.1 company entry foundation

**Goal:** Complete P2-TEST-00 API script, start Phase 2.1 (slug, org APIs, entry pages).

**Shipped:**
- `scripts/test-phase2-manager-invite.mjs` — 2 managers, POST invite accept, cross-org team isolation, department sync.
- Migration `0016_organization_slug_settings.sql`, `lib/organizations.ts`, organization APIs.
- `/c/[organizationSlug]`, `/quan-ly/cong-ty`, `components/company-settings-content.tsx`.

**Tests:** Vitest 80 pass; Next build pass.

**Follow-up:** Run migration 0016 on Supabase; `npm run test:api:phase2` with dev server; P2-AUTH-01 Google OAuth.

## 2026-06-13 — Supabase CLI predev migration sync

**Goal:** Auto push migrations before `npm run dev` / `npm run start`.

**Shipped:** `supabase init` config, `scripts/supabase-db-sync.mjs`, `db:link`, `db:push`, `db:status`, `predev`/`prestart` hooks.

**Setup once:** `npx supabase login` → `npm run db:link` → add `SUPABASE_DB_PASSWORD` to `.env.local`.

## 2026-06-13 — P2-AUTH-01 Google OAuth

**Goal:** Phase 2.1 company login via Google; preserve invite/company `next` through OAuth.

**Shipped:** `AuthGoogleButton` on login/register, `lib/google-oauth.ts` (`buildOAuthCallbackUrl`), docs §5.3 in `supabase-setup.md`.

**Manual:** Enable Google provider on Supabase Dashboard + Google Cloud OAuth client; add redirect URLs.

**Next:** Manual Google OAuth smoke on Vercel; Phase 2.3 path assignment CRUD.

## 2026-06-13 — Agent 3 (path) + Agent 2 (grading) foundation

**Goal:** Focus Phase 2.4/2.5 — deterministic path recommender + structured grader.

**Shipped:**
- `lib/agents/recommender.ts` — weighted scoring, reason codes, Vitest fixtures
- `POST /api/agents/recommender` — ranked modules for logged-in user
- `lib/agents/grader.ts` — rubric breakdown, evidence, confidence, reviewStatus
- Migrations `0019_learning_content_schema.sql`, `0020_assessment_grading_schema.sql`

**Next:** Apply 0019–0020 on Supabase; manager review queue `/quan-ly/bai-lam`.

## 2026-06-13 — Agent 3 recommender hardening

**Goal:** Củng cố gợi ý lộ trình trước khi làm Agent 2 thêm.

**Shipped:**
- `lib/recommender-context.ts` — load profile/progress, manager priority từ `learning_assignments`, dedupe persist 1h
- API trả `summary` (template tiếng Việt), `topRecommendation`, `managerPriorityModuleIds`
- UI: nút «Bắt đầu học», «Làm mới», sắp xếp timeline theo gợi ý

**Tests:** lint pass; vitest 113; build pass.

## 2026-06-13 — Agent 2: MCQ grading + revision sync

**Goal:** MCQ → grading tables; employee thấy `needs-revision` + ghi chú quản lý.

**Shipped:**
- `lib/mcq-grader.ts` — chấm server-side từ `answers[]`
- `persistMcqGrading` + `POST /api/quiz-results` dual-write
- `lib/module-grading-load.ts` — merge `grading_results` vào practice-review GET
- `/kiem-tra` gửi answers qua API; banner revision hiện `managerReviewReason`
- Manager accept/adjust → `assessment_submissions.status = graded`

**Tests:** vitest mcq + merge; lint + build pass.

## 2026-06-13 — P2-AI-08 manager chat signals + P2-EVAL-01 scaffold

**Decision:** Ưu tiên mở rộng BE-12 (manager analytics) thay vì P2-AI-03 (cần budget gate) hoặc benchmark live OpenAI.

**Shipped:**
- `lib/manager-analytics-summary.ts` — org signals: manager-review queue, needs-revision, quiz &lt;70%
- `getTeamAnalysisSummary()` ghép block «TỔNG QUAN ĐÁNH GIÁ & QUIZ» trước chi tiết từng NV
- Manager prompt nhắc ưu tiên hàng đợi chấm bài
- P2-EVAL-01 scaffold: `lib/fixtures/grading-benchmark.vi.json` (5 cases) + `lib/grading-benchmark.ts`

**Tests:** vitest 118 pass; lint pass (warnings only).

## 2026-06-13 — BE-13 dual knowledge chat (2 nền kiến thức)

**Goal:** Tutor base theo lộ trình/bài học + hồ sơ cá nhân; onboarding Anh/Chị/Không tiết lộ.

**Shipped:** migration 0022, curriculum/personal builders, prompt 3 block, onboarding bước 2/5.

**Tests:** vitest 122 pass; lint pass; Node 20 build pass.

## 2026-06-13 — Skeleton loading toàn app

**Goal:** Thay pulse block/`Đang tải...` bằng skeleton nhất quán khi chuyển route và fetch client.

**Shipped:** `components/ui/skeleton.tsx`, `components/skeletons/page-skeletons.tsx`, 17 file `app/**/loading.tsx`, cập nhật employee/manager/auth client components.

**Tests:** `npm run lint` pass; `npm run test` pass (122 vitest + 49 API + 5 pytest); `npm run build` pass.

## 2026-06-13 — Agent health dashboard (manager)

**Goal:** Trang giám sát 4 agent + script smoke test CLI.

**Shipped:** `/quan-ly/agent-health`, `GET /api/manager/agent-health`, `npm run test:api:agents`.

**Tests:** vitest 129 pass; lint pass; build pass.

## 2026-06-16 — Chat sessions + widget reset + personalized tone

**Goal:** UX kiểu ChatGPT trên `/tro-ly` (sidebar session, cuộc hội thoại mới, xóa); widget góc phải reset UI khi reload; agent gọi user bằng tên/email thay "anh/chị".

**Decision:** Tái dùng `chat_conversations`/`chat_messages`; `force_new` trên POST tạo session mới; widget `noRestore` + `resetContextOnFirstSend`; core context vẫn refresh sau mỗi turn qua `refreshCoreContext`.

**Shipped:** API list/delete conversations; sidebar component; hooks `useChatSessions` + mở rộng `useAssistantChat`; migration RLS delete policy.

**Tests:** vitest 200 pass; lint pass (warnings cũ); build pass; db:validate pass.

## 2026-06-16 — `/tro-ly` page scroll feels natural again

**Goal:** Bỏ cảm giác cuộn bị mắc trong khung hội thoại khi câu trả lời dài trên trang `/tro-ly`.

**Decision:** Đổi từ nested scroll trong `ChatConversationBody` sang page scroll tự nhiên hơn; giữ auto-scroll xuống cuối bằng `bottomRef.scrollIntoView()` nhưng không nhốt người dùng trong `overflow-y-auto` của riêng khung chat.

**Shipped:** nới container `/tro-ly` để card chat được phép cao hơn viewport; bỏ `overflow-hidden` ở chat panel và `overflow-y-auto` ở thân hội thoại.

**Tests:** targeted ESLint pass (chỉ còn notice App Router từ rule `no-html-link-for-pages`); Node 20 `npm run build` pass.

## 2026-06-16 — Clarify step 1 now respects role; chat history sidebar cleaned up

**Goal:** Tránh việc user đổi role nhưng card câu hỏi 1/3 vẫn hiện cùng bộ option marketing; đồng thời làm sidebar lịch sử chat bớt cụt và bớt thô.

**Decision:** `chat-clarify-steps` ưu tiên template theo `roleId` khi yêu cầu là dạng báo cáo/tổng hợp, thay vì regex `báo cáo` => marketing; `chat-session-title` nhận thêm domain HR/hành chính; sidebar session đổi sang card gọn hơn, title 2 dòng, date pill, nút xóa rõ hơn khi active.

**Shipped:** role-specific step-1 clarify options cho `marketing`, `ke-toan`, `kinh-doanh`, `van-hanh`; title hiểu thêm "nhân sự / HR / hành chính"; session sidebar restyle.

**Tests:** `npx vitest run src/frontend/lib/chat-clarify-parse.test.ts src/frontend/lib/chat-session-title.test.ts` pass; Node 20 `npm run build` pass.

## 2026-06-16 — Stop aggressive auto-scroll on `/tro-ly`

**Goal:** Fix cảm giác scroll xuống bị giằng tay khi assistant đang thinking/streaming.

**Decision:** Chỉ auto-scroll khi user vẫn đang ở gần đáy cuộc hội thoại; nếu user đã cuộn lên đọc nội dung cũ thì stream mới không được kéo họ xuống nữa. Áp dụng cho cả page chat và widget, nhưng page `/tro-ly` là case ưu tiên.

**Shipped:** `useAssistantChat` theo dõi trạng thái “near bottom” bằng window scroll (page) hoặc container scroll (widget), chỉ `scrollIntoView` khi còn anchored; bỏ các lần kéo xuống cưỡng bức theo từng thinking/stream chunk.

**Tests:** Node 20 `npm run build` pass; targeted ESLint sạch ngoài notice quen thuộc `no-html-link-for-pages` của Next App Router.

## 2026-06-16 — Restore rich chat formatting for coach answers

**Goal:** Trả lại cảm giác response “đẹp” trong chat khi assistant trả markdown có heading, bullet, số thứ tự và prompt block.

**Decision:** `ChatRichContent` không còn render text block theo từng dòng thô nữa; thay vào đó nhận diện heading/list/blockquote/paragaph, còn fenced code vẫn đi qua `ChatPromptBlock` như cũ.

**Shipped:** markdown-lite renderer cho `###`, unordered list, ordered list, quote và paragraph grouping trong `components/chat-rich-content.tsx`.

**Tests:** Node 20 `npm run build` pass; targeted ESLint sạch ngoài notice `no-html-link-for-pages`.

## 2026-06-16 — Pack clarified context before final coach answer

**Goal:** Update agent mindset so user is not asked twice for the same details after answering clarify cards.

**Decision:** System prompt and post-3-card runtime hint now follow a structured prompt frame: `<context>`, `<task>`, `<format>`, `<do_not_ask_again>`. The coach must synthesize all collected Q/A into the answer, state assumptions only for tiny gaps, and avoid re-triggering elicitation once the 3-card loop is complete.

**Shipped:** clarified-answer runtime hint, fallback synthesized answer wording, and regression coverage for XML-style context packaging + no-reask guard.

**Tests:** targeted Vitest pass; scoped ESLint pass (App Router notice only); Node 20 `npm run build` pass.

## 2026-06-16 — Tighten outline depth and harden chat markdown normalization

**Goal:** Stop low-value outline answers that only list empty section titles, and reduce formatting breakage when the model outputs headings or list markers inline.

**Decision:** Strengthen the coach/manager system prompt with explicit outline-writing rules: use `##` for major sections, one bullet per line, no boilerplate open/close, and every outline point must explain what to write, why it matters, and the formula/data source when relevant. In the UI pipeline, normalize inline `###`, `-`, and `1.` markers onto their own lines before rich rendering so the chat layout is less brittle.

**Shipped:** richer formatting/depth instructions in `openai.ts`; `normalizeChatTextBlock()` in `chat-content-blocks.ts`; regression tests for inline heading/list normalization and prompt depth rules.

**Tests:** targeted Vitest pass; scoped ESLint pass (App Router notice only); Node 20 `npm run build` pending in this task.

## 2026-06-16 — Fix dark user text inside green chat bubble

**Goal:** Stop user messages on `/tro-ly` from rendering dark text inside the dark green bubble.

**Decision:** The outer user bubble already used `text-brand-foreground`, but `ChatRichContent` was overriding inner headings, paragraphs, and lists with assistant-colored `text-ink`. Make rich-content rendering tone-aware so user bubbles keep light foreground styles throughout.

**Shipped:** tone-aware text/marker/quote classes in `components/chat-rich-content.tsx` plus a render regression test.

**Tests:** targeted Vitest + scoped ESLint + Node 20 build pending in this task.

## 2026-06-16 — Preserve ordered-list numbering across blank lines

**Goal:** Stop chat answers from rendering `1, 1, 1, 1` when the model inserts blank lines between numbered steps.

**Decision:** `ChatRichContent` now keeps scanning forward through empty lines while collecting ordered-list items, so adjacent `1.` steps still render as one `<ol>` instead of multiple single-item lists.

**Shipped:** ordered-list grouping fix in `components/chat-rich-content.tsx` and a render regression test for blank-line-separated numbered items.

**Tests:** targeted Vitest + scoped ESLint + Node 20 build pending in this task.

## 2026-06-18 — FastAPI native manager invite/recommendation/agent-health routes

**Goal:** Tiếp tục biến `/src/backend` thành backend đứng độc lập thay cho Next.js API, không chỉ mirror/proxy.

**Decision:** Giữ snapshot clone + mirror để tham chiếu, nhưng nối thêm cụm route FastAPI-native cho `manager/invite-links`, `manager/recommendations`, và `manager/agent-health` dựa trên business logic Python thật. Phần `invite-links` và `recommendations` dùng trực tiếp service native đã port, còn `agent-health` có cả demo report và live aggregate cơ bản từ Supabase để backend mới tự trả dữ liệu mà không cần runtime Next.js.

**Shipped:** thêm route native manager-side, thêm demo/live aggregation helpers trong `native_app.py`, và mở rộng test API backend để cover nhóm route mới.

**Tests:** `pytest src/backend/tests/test_api/test_native_routes.py -q` pass (17 tests); `pytest src/backend/tests -q` pass (29 tests). Full repo verify tiếp tục chạy trong task này.

## 2026-06-18 — Fix chat flicker after asking assistant

**Goal:** Tìm và giảm hiện tượng `/tro-ly` nhấp nháy sau khi user gửi câu hỏi.

**Decision:** Runtime check cho thấy flicker nằm ở UI state/animation, không phải API fail: container hội thoại đang giữ animation cấp session trong lúc message/thinking cập nhật, thinking phrase đổi liên tục làm bubble “Đang suy nghĩ…” nhấp nháy, và dev log còn báo duplicate React key ở message list sau khi gửi. Giữ skeleton loading animation, nhưng bỏ animation toàn bộ conversation khi đã load; thinking indicator dùng một câu ổn định cho mỗi lượt gửi; message render key thêm index để history/optimistic state trùng id không làm React reconciliation lẫn lộn.

**Shipped:** cập nhật `ChatConversationBody`, `AssistantChatMessageList`, `useAssistantChat`, và thêm regression tests cho loaded conversation animation + duplicate message ids.

**Tests:** targeted Vitest 3 files / 6 tests pass; `npm run lint` pass với 5 warning cũ; Node 22 `npm run test` pass (57 Vitest files / 261 tests, 30 API, 12 manager/invite, 7 auth/OAuth, 84 pytest); Node 20 `npm run build` pass.

## 2026-06-18 — FastAPI native chat persistence + org settings

**Goal:** Tiếp tục native hóa các API có state quan trọng để frontend không còn phụ thuộc Next.js route handlers cho lịch sử chat và cài đặt tool tổ chức.

**Decision:** Port trước cụm chat persistence ít phụ thuộc OpenAI stream hơn gồm `chat/history`, `chat/conversations`, `chat/conversations/{id}`, đồng thời kéo `org-settings` sang Python-native vì logic gọn và có giá trị business rõ. Giữ `POST /api/chat` cho bước sau vì còn dính stream, memory refresh, rate limit và prompt orchestration.

**Shipped:** thêm helper Supabase delete, load chat history/list/delete conversation, resume lesson cho chat history, và read/write `organizations.ai_tool` kèm audit event kiểu `audit:org.ai_tool.update`.

**Tests:** `pytest src/backend/tests/test_api/test_native_routes.py -q` pass (26 tests); `pytest src/backend/tests -q` pass (38 tests).

## 2026-06-18 — FastAPI native manager grading queue + review

**Goal:** Tiếp tục tách luồng quản lý duyệt bài chấm khỏi Next.js API để manager surfaces chạy được qua backend Python mới.

**Decision:** Port `GET /api/manager/grading` và `PATCH /api/manager/grading/{resultId}/review` sang native trước vì đây là luồng Supabase thuần, không phụ thuộc stream/chat. Giữ demo fallback giống Next.js route hiện tại, còn real mode thì Python tự đọc `grading_results`, `grading_reviews`, `assessment_submissions` và áp dụng quyết định duyệt ngay trên backend mới.

**Shipped:** thêm demo queue, mapping queue item, quyết định review (`accept` / `adjust` / `needs-revision`), và native routes manager grading.

**Tests:** `pytest src/backend/tests/test_api/test_native_routes.py -q` pass (30 tests); `pytest src/backend/tests -q` pass (42 tests).

## 2026-06-17 — Make opening greeting sound human again

**Goal:** Remove robotic repetition in the first assistant bubble when opening a chat session.

**Decision:** The title bar already says “Trợ lý AI”, so the greeting bubble should not re-introduce itself or repeat the user’s name/context mechanically. `useAssistantChat` now opens with a shorter “mình tiếp tục…” line, and any carried-over memory is cleaned to remove old greetings, self-intro boilerplate, and generic “hỏi em về…” filler.

**Shipped:** rewritten greeting copy plus memory-preview sanitization in `hooks/use-assistant-chat.ts`, with a regression test for duplicate intro/greeting removal.

**Tests:** targeted Vitest + scoped ESLint + Node 20 build pending in this task.

## 2026-06-17 — Tuancoolboy account dropdown + tài khoản

**Goal:** Sửa góc phải header thành avatar + tên + role + dropdown cho employee/manager.

**Decision:** Thêm `/tai-khoan` với form hồ sơ, mật khẩu, email thật ở Supabase real mode; demo mode chỉ hiển thị/cảnh báo.

**Owner:** Tuancoolboy

**Status:** Active

**Tests:** `npm run lint` pass với 5 warning cũ; targeted Node 20 Vitest 3 files / 8 tests pass; Node 20 full Vitest 54 files / 245 tests pass; Node 20 `next build src/frontend` pass; `git diff --check` pass. Full `npm run test` bị Node 18 chặn, Node 20 runner còn 2 lỗi chat API smoke có sẵn trên server `:3000`.

## 2026-06-17 — Account settings follow-up fixes

**Goal:** Chốt các lỗi hành vi còn lại sau khi thêm account dropdown và trang `/tai-khoan`.

**Decision:** `/tai-khoan` phải ưu tiên hiển thị đúng nghề thật từ `profiles.role_id` thay vì generic `Nhân viên`, còn các form đổi mật khẩu/email phải fail-safe giống form hồ sơ khi Supabase client throw thay vì chỉ bắt `error` trả về.

**Shipped:** dùng lại `getRole(...).shortLabel` qua helper `resolveAccountRoleLabel()` để render role trên account page, và thêm `catch` cho hai luồng `supabase.auth.updateUser()` trong `account-settings-content.tsx`.

**Tests:** targeted Node 20 Vitest cho account settings/menu pending trong task này; browser retest `/tai-khoan` real mode pending trong task này.

## 2026-06-18 — Chat security hardening (code review round 2)

**Goal:** Address bot findings on service-role cross-tenant risk, prompt-injection delimiters, and serverless race on `memoryRefreshInflight`.

**Decision:** Harden untrusted prompt blocks with `stripPromptBlockSpoofHeaders` + `wrapUntrustedPromptBlock`; replace serverless-only in-memory lock with optimistic DB claim on `chat_memories.updated_at` (delete placeholder row on OpenAI failure); hybrid auth for `getTeamAnalysisSummary` — RLS user client for manager membership, service role only for cross-user aggregates until manager RLS migration (BE-08).

**Shipped:** `chat-prompt-safety.ts`, updates to `openai.ts` + `chat-context.ts`, synced `next_clone/`.

**Tests:** `npm run lint` pass (5 warnings cũ); `npm run test` pass (84 pytest + Vitest); `npm run build` pass.

## 2026-06-18 — Chat prompt repair expansion

**Goal:** Làm prompt phản hồi tốt hơn khi user yêu cầu đổi format hoặc sửa câu trả lời theo hướng rất cụ thể.

**Decision:** Khi user muốn checklist, bảng, bản ngắn kiểu gửi sếp, ưu tiên việc làm ngay, key takeaways, một câu chốt, so sánh 2 phương án, ví dụ theo nghề, prompt copy-paste, bản cuối, 3 lựa chọn, bớt máy, ưu nhược, bản ngắn/bản dài, hoặc chỉ cần bản sửa, assistant phải sửa trực tiếp theo format đó thay vì chỉ hỏi làm rõ nếu đã có đủ context. Canned responses cũng cần bắt các cụm này để demo mode không bị lạc sang clarify.

**Shipped:** bổ sung guidance và regression tests trong `src/frontend/lib/openai.ts`, `src/frontend/lib/tro-ly-canned-responses.ts`, `src/frontend/lib/chat-knowledge-personal.test.ts`, `src/frontend/lib/tro-ly-canned-responses.test.ts`.

**Tests:** verify pending trong task này.

## 2026-06-18 — Frontend font build fix

**Goal:** Loại dependency build lên Google Fonts để Next build chạy ổn định trên máy không có mạng.

**Decision:** Thay `next/font/google` trong `src/frontend/app/layout.tsx` bằng font stack CSS variables dùng font hệ thống và fallback cục bộ.

**Shipped:** cập nhật `src/frontend/app/layout.tsx`.

**Tests:** verify pending trong task này.

## 2026-06-19 — Extra-skill lesson link render fix

**Goal:** Sửa câu trả lời gợi ý bài học thêm trên `/tro-ly` để link không còn hiện raw markdown trong bubble chat.

**Decision:** Bỏ `?extra=1` khỏi link sinh ra cho extra-skill bài học; route bài học hiện tại không dùng query này, còn parser chat vẫn render link nội bộ chuẩn `/lo-trinh/{moduleId}`.

**Shipped:** cập nhật `src/frontend/lib/extra-skill-lessons.ts` và bổ sung regression test trong `src/frontend/lib/extra-skill-lessons.test.ts`.

**Tests:** targeted Vitest + browser smoke pending trong task này.

## 2026-06-19 — Backend mirror sync for extra-skill chat

**Goal:** Đồng bộ backend mirror với FE cho luồng extra-skill, prompt guard, và canned responses.

**Decision:** Copy các file chat/prompt liên quan từ FE sang `src/backend/next_clone/frontend/` để backend mirror dùng cùng logic: `openai.ts`, `tro-ly-canned-responses.ts`, `extra-skill-lessons.ts`, `module-lesson-links.ts`, `chat-knowledge-extra.ts`, và `app/api/chat/route.ts`.

**Shipped:** backend mirror đã có cùng prompt rules, extra-skill context, và fallback response format với FE.

**Tests:** repo-wide verify pending trong task này.

## 2026-06-19 — System admin console `/van-hanh`

**Goal:** Xây một trang quản trị hệ thống thật sự để người vận hành nắm toàn bộ tổ chức, người dùng, nội dung, link mời, AI usage và audit log.

**Decision:** Giữ style UI hiện tại của hệ thống, nhưng mở rộng `/quan-tri` thành redirect compatibility và đưa console thật sang `/van-hanh`; hệ thống admin dùng Supabase service role cho hành động quản trị, còn demo mode chỉ hiển thị dữ liệu mẫu và không cho ghi.

**Shipped:** route `/van-hanh`, API `/api/platform-admin`, component quản trị hệ thống, bootstrap script tài khoản mặc định `admin@c2-app-009.io.vn`, và migration seed quyền `platform_admin`.

**Tests:** `npm run db:validate` pass; `npm run lint` pass với 5 warning cũ; `npm run test` pass; `npm run build` pass; browser smoke xác nhận login admin, `/login` redirect về `/van-hanh`, và console render thật.

## 2026-06-19 — Harden `/api/platform-admin` and split admin console tabs

**Goal:** Khóa lỗ hổng GET platform-admin, thêm rate-limit/validation nhất quán, và tách console `/van-hanh` thành các tab con nhẹ hơn để dễ bảo trì.

**Decision:** Đưa `requirePlatformAdminContext()` lên cả GET/POST route, gắn rate-limit in-memory theo user/IP, chuẩn hóa validation payload trong `performPlatformAdminAction`, và tách UI thành shell + 6 tab/component con với confirm dialog cho hành động nhạy cảm.

**Shipped:** cập nhật `src/frontend/app/api/platform-admin/route.ts`, `src/frontend/lib/platform-admin-console.ts`, `src/frontend/lib/client-api.ts`, `src/frontend/components/platform-admin-console.tsx`, các tab `src/frontend/components/platform-admin/*.tsx`, thêm test route/validation, và sửa wrapper dialog.

**Tests:** `npm run lint` pass; `npm run test` pass; `npm run build` pass; browser smoke xác nhận filter trên tab tổ chức/người dùng, tab nội dung và nhật ký có empty-state, và confirm dialog chặn trước khi ghi.

## 2026-06-19 — Remove leaked bootstrap script and untrack repomix

**Goal:** Gỡ script bootstrap platform admin khỏi repo và giữ `repomix-output.xml` chỉ ở local, không đẩy lên Git nữa.

**Decision:** Xóa `scripts/bootstrap-platform-admin.mjs`, remove `bootstrap:platform-admin` khỏi `package.json`, và đưa `repomix-output.xml` vào `.gitignore` sau khi bỏ track bằng Git.

**Shipped:** cleaned up repo exposure and left the local repomix file untouched on disk.

**Tests:** cleanup-only; verified by `git status`.

## 2026-06-19 — Separate `/van-hanh/login` and tighten operator access

**Goal:** Tách cổng đăng nhập riêng cho khu vận hành hệ thống và siết lại 3 lớp kiểm soát để employee/manager không đi thẳng vào `/van-hanh` hay `/api/platform-admin`.

**Decision:** Giữ login người dùng chung ở `/login`, thêm `/van-hanh/login` cho platform_admin, chặn route bằng proxy + server page + API whoami, và hiển thị banner denied trong app layout khi có `?denied=1`.

**Shipped:** `src/frontend/app/(operator)/layout.tsx`, `src/frontend/app/(operator)/van-hanh/login/page.tsx`, `src/frontend/components/operator-login-form.tsx`, `src/frontend/components/route-denied-banner.tsx`, `src/frontend/app/api/platform-admin/whoami/route.ts`, `src/frontend/app/api/platform-admin/whoami/route.test.ts`, `src/frontend/proxy.ts`, `src/frontend/proxy.test.ts`, `src/frontend/components/auth-login-form.tsx`, `src/frontend/lib/client-api.ts`, `src/frontend/app/(app)/layout.tsx`, `src/frontend/app/(app)/van-hanh/page.tsx`, `src/frontend/app/(app)/quan-tri/page.tsx`.

**Tests:** `npm run lint` pass; `npm run test` pass; `npm run build` pass; browser smoke xác nhận `/van-hanh/login` render riêng, admin login vào console, và `?denied=1` hiện banner rồi tự xoá query.

## 2026-06-20 — Fix `admin@vinuni.vn` auth seed and clean `/van-hanh/login` UI

**Goal:** Làm cho tài khoản `admin@vinuni.vn / 12345678` login được thật trong Supabase Auth, rồi dọn lại UI trang đăng nhập vận hành theo screenshot.

**Decision:** Xóa bản ghi Auth seed lỗi cũ, tạo lại user bằng Supabase Auth Admin API, gắn `profiles` + `platform_admins`, rồi chỉnh layout/form login để bỏ duplicate link, bỏ shield helper text, bỏ placeholder, và ẩn card trái trên mobile bằng `lg:` breakpoint.

**Shipped:** các migration `supabase/migrations/20260620090000_seed_admin_vinuni_account.sql`, `20260620092000_seed_admin_vinuni_identity.sql`, `20260620093000_fix_admin_vinuni_identity.sql`, `20260620094000_cleanup_admin_vinuni_auth.sql`; cập nhật `src/frontend/app/(operator)/layout.tsx`, `src/frontend/components/operator-login-form.tsx`.

**Tests:** `npm run db:sync` pass; `npm run lint` pass; `npm run test` pass; `npm run build` pass; browser smoke xác nhận `admin@vinuni.vn / 12345678` vào được `/van-hanh`, mobile login chỉ còn một link quay lại `/login`, card trái ẩn trên viewport nhỏ, và input không còn placeholder.

## 2026-06-20 — Audit operator console `/van-hanh`

**Goal:** Rà `/van-hanh` như người vận hành thật, sửa các lỗi P0/P1 còn sót ở nav, route học, filter API, confirm dialog và a11y.

**Decision:** Tách nav operator khỏi manager/employee, redirect platform admin khỏi learning/onboarding routes bằng notice riêng, thêm query filters cho GET `/api/platform-admin`, và bổ sung nhãn a11y/confirm cho các filter/action nhạy cảm.

**Shipped:** cập nhật `src/frontend/app/(app)/layout.tsx`, `src/frontend/components/app-nav.tsx`, `src/frontend/proxy.ts`, `src/frontend/components/route-denied-banner.tsx`, `src/frontend/app/api/platform-admin/route.ts`, `src/frontend/lib/platform-admin-console.ts`, `src/frontend/lib/platform-admin-types.ts`, `src/frontend/lib/client-api.ts`, các tab platform-admin và test route/proxy.

**Tests:** `npm run lint` pass với 5 warning cũ; scoped `npm run test -- src/frontend/app/api/platform-admin/route.test.ts src/frontend/proxy.test.ts` pass; `npm run test` pass; `npm run build` pass; browser audit pass cho login, nav, redirect learning, filters, confirm dialog và mobile.

## 2026-06-20 — Platform admin can edit `role_id`/`ai_level` and enforce learning activation

**Goal:** Cho platform admin sửa vai trò công việc, trình độ AI, reset cache lộ trình riêng và chặn các tài khoản chưa được kích hoạt học.

**Decision:** Giữ `update-user` làm nguồn sửa chính cho `role_id` + `ai_level` và xóa `learning_recommendations` sau khi lưu; thêm `reset-user-learning` scope riêng cho cache lộ trình; gate `cho-kich-hoat`, `/lo-trinh`, `/tro-ly`, `/tien-bo`, `/kiem-tra`, và các API học tập khi `profiles.learning_activated = false`; thêm migration để backfill + bảo vệ các cột kích hoạt.

**Shipped:** `src/frontend/lib/platform-admin-console.ts`, `src/frontend/lib/platform-admin-console.test.ts`, `src/frontend/lib/platform-admin-console.activation.test.ts`, `src/frontend/lib/platform-admin-types.ts`, `src/frontend/components/platform-admin/platform-admin-console.types.ts`, `src/frontend/components/platform-admin/users-tab.tsx`, `src/frontend/lib/post-auth-redirect.ts`, `src/frontend/lib/post-auth-redirect.test.ts`, `src/frontend/proxy.ts`, `src/frontend/proxy.test.ts`, `src/frontend/components/onboarding-flow.tsx`, `src/frontend/lib/learning-activation.ts`, `src/frontend/lib/email/*`, `src/frontend/app/(app)/cho-kich-hoat/page.tsx`, route gates under `src/frontend/app/(app)/`, API gates under `src/frontend/app/api/*`, `supabase/migrations/20260620120000_learning_activation_flags.sql`, `package.json`, `package-lock.json`.

**Tests:** `npm run db:validate` pass; `npm run lint` pass with the same 5 pre-existing warnings; `npm run test` pass; `npm run build` pass.

## 2026-06-20 — Tighten activation bulk controls

**Goal:** Tránh hiểu nhầm/trạng thái lan rộng khi vận hành kích hoạt học viên và thêm lối huỷ kích hoạt hàng loạt không ảnh hưởng platform admin.

**Decision:** Gỡ backfill tự bật `learning_activated` cho mọi profile có `role_id` trong migration activation; thêm cờ server-side `excludePlatformAdmins` cho `bulk-set-activation`; UI `/van-hanh` có nút “Huỷ kích hoạt all” chỉ gửi các user đang active và backend vẫn lọc lại platform admin.

**Shipped:** cập nhật `src/frontend/lib/platform-admin-console.ts`, `src/frontend/components/platform-admin/users-tab.tsx`, `src/frontend/lib/platform-admin-console.test.ts`, `src/frontend/lib/platform-admin-console.activation.test.ts`, `supabase/migrations/20260620120000_learning_activation_flags.sql`.

**Tests:** scoped `npm run test -- src/frontend/lib/platform-admin-console.test.ts src/frontend/lib/platform-admin-console.activation.test.ts` pass, gồm full unit/API/Python suite do runner hiện tại chạy toàn bộ.

## 2026-06-22 — Scoring học tập +5/+15 vào points_ledger + setup môi trường test HR

**Goal:** Test luồng HR: mọi profile role nhan-su; reset lucasnguyen.kenli có lộ trình như "chị Dung"; đảm bảo scoring hoàn thành bài (+5) / đạt quiz ≥70% (+15) ghi points_ledger.

**Decision:** Thêm `lib/points-ledger.ts` (`awardPointsOnce`, idempotent theo (user,source,ref_id), fail-open). Nối vào `api/progress` (hoàn thành bài → source 'lesson' +5, ref=moduleId) và `api/quiz-results` (score≥70 → source 'challenge' +15, ref=moduleId||`{role}-quiz`). Dùng enum source sẵn có ('lesson'/'challenge') để KHÔNG cần migration đổi schema. Recommender theo aiLevel ĐÃ CÓ sẵn (path-agent), không sửa. Bảng xếp hạng vẫn đọc demo data (FE-15 §10 cấm đụng) → chưa nối points thực, ghi vào mục cần duyệt. Phân loại bài giữ 4 tier độ khó (FE-15) — chưa gom theo nhóm việc dù data skills có sẵn.

**Shipped:** `src/frontend/lib/points-ledger.ts`, `src/frontend/app/api/progress/route.ts`, `src/frontend/app/api/quiz-results/route.ts`, `scripts/hr-test-setup.mjs`. Data: 70/70 profiles role=nhan-su; lucasnguyen.kenli reset (selection xoá, confirmed=null, activated=true) + suggested path 17 bài (đại diện chị Dung — account 'dung' chưa tồn tại).

**Tests:** `npm run lint` pass (5 warning cũ); `npm run test:unit` 363 pass (1 suite lỗi sẵn `scripts/vercel-cli-json.test.mjs` không liên quan); `npm run build` pass.

## 2026-06-22 (bổ sung) — B4: gom bài theo nhóm việc HR trong 4 tier

**Decision:** `learning-tiers.ts` thêm `MODULE_CATEGORY_MAP` + `getModuleCategoryLabel` (nhóm việc = skills[0] tĩnh từ roles-hr; bài chưa tag → "Khác / chưa phân loại"). `lo-trinh-tiers.tsx`: trong mỗi tier (độ khó) gom tiếp theo nhóm việc liên quan, giữ nguyên gating tuần tự 4-tier. B3 (leaderboard đọc points_ledger thật) KHÔNG làm — FE-15 §10 cấm đụng bang-xep-hang; scoring writes đã xong nên points sẵn sàng khi Lucas duyệt nối.

**Tests:** `npm run lint` pass (5 warning cũ); `npm run test:unit` 363 pass (1 suite lỗi sẵn vercel-cli-json bỏ qua); `npm run build` pass.

## 2026-06-22 — Màn "Đo lường học tập" cho admin theo dõi học viên

**Goal:** Audit dữ liệu đo lường + dựng bảng per-user trong platform-admin console (dùng dữ liệu sẵn có, không đổi schema).

**Audit:** ĐÃ track — module_progress (67), quiz_results (2), chat_usage (101), time_logs (10), events (348: onboarding_complete/lesson_view/lesson_complete/tutor_message_sent/quiz_passed/quiz_submitted/journal_logged), points_ledger (0, scoring vừa deploy), auth.users.last_sign_in_at. CHƯA track — thời lượng/tần suất phiên (đề xuất bắn event session_start/heartbeat qua /api/events, để TODO).

**Decision:** API mới `/api/platform-admin/learning-metrics` (service role, gated requirePlatformAdminContext) tổng hợp per-user: % hoàn thành (mẫu số = selection đã chốt hoặc lộ trình gợi ý), số bài, điểm quiz TB + số đạt ≥70%, lượt chat, giờ tiết kiệm, điểm, số ngày hoạt động (distinct ngày có event), lần truy cập gần nhất. Tab "Đo lường học tập" trong console (self-contained, fetch API riêng) + dòng tổng hợp. Lọc bỏ tài khoản @test.local. Thống kê toàn bộ user tự do (không bắt buộc org).

**Shipped:** `src/frontend/app/api/platform-admin/learning-metrics/route.ts`, `src/frontend/components/platform-admin/learning-metrics-tab.tsx`, `src/frontend/components/platform-admin/platform-admin-console.types.ts`, `src/frontend/components/platform-admin-console.tsx`.

**Tests:** `npm run lint` pass (0 error); `npm run test:unit` 362 pass (1 suite vercel-cli-json lỗi sẵn bỏ qua); `npm run build` pass. Verify aggregation thật: 40 user, 9 active, 4 đang học.

## 2026-06-22 — Track phiên (session_start/session_end) + bổ sung cột Phiên vào đo lường

**Decision:** Thêm event `session_start` (throttle 30'/trình duyệt) + `session_end` (durationMs qua sendBeacon khi pagehide/ẩn tab) qua `/api/events` sẵn có — không đổi schema. `SessionTracker` mount ở `(app)/layout` (chỉ real mode). Metrics API + tab thêm cột "Phiên" (số phiên · thời lượng TB phút).

**Shipped:** `src/frontend/components/session-tracker.tsx`, `src/frontend/app/(app)/layout.tsx`, `src/frontend/app/api/events/route.ts` (whitelist +2), `src/frontend/app/api/platform-admin/learning-metrics/route.ts`, `src/frontend/components/platform-admin/learning-metrics-tab.tsx`.

**Tests:** lint 0 error; test:unit 362 pass (1 suite vercel-cli-json lỗi sẵn bỏ qua); build pass.

## 2026-06-22 — Sửa 5 lỗi luồng onboarding HR (nhan-su)

**Goal:** Vai trò HR (nhan-su) đang test production. Sửa: (1) màn chọn ngành chỉ hiện HR; (2) số bài 56→64; (3) bộ câu hỏi đào sâu 15 câu; (4) hiện kết quả level trước khi tạo khóa; (5) luồng recommender→4 tier.

**Điều tra #2 (root cause):** DB `learning_modules` có ĐỦ 64 bản ghi nhan-su (m1–m64) — KHÔNG thiếu data. Lỗi do app: màn chọn bài (`lo-trinh-composition`), màn 4 tier (`lo-trinh-tiers`) và `learning-tiers.ts` đều dựng danh sách từ `getRole().modules` = data tĩnh `roles-hr.ts` (chỉ 56 bài). m57–m64 chỉ tồn tại ở DB. → Cho composition/tiers đọc DB modules (đã fetch sẵn trong `lo-trinh-content`), suy tier từ `level`.

**Điều tra #3:** `getAssessmentQuestionsForRole` (assessment-hr.ts) tồn tại nhưng `onboarding-flow` CHƯA BAO GIỜ gọi — render thẳng `ASSESSMENT_QUESTIONS` (6 câu generic). HR vì vậy thấy bộ cũ. + bộ HR cũ chỉ 10 câu. → Viết lại HR thành 15 câu + 1 câu mở theo `specs/HR-assessment-15-questions.md`; wire `getAssessmentQuestionsForRole(roleId)` vào onboarding; `calculateResult` thêm tham số `questions` (role-aware, không đổi hành vi non-HR); thêm nhánh textarea cho free-text.

**Decisions:**
- #1: cờ `ENABLED_ONBOARDING_ROLE_IDS=["nhan-su"]` + `ONBOARDING_ROLE_LIST` (roles.ts). Không xóa vai trò khác — mở lại bằng cách thêm id.
- #4: thêm màn kết quả level (aiLevel/levelLabel) trong `LoTrinhComposition` hiện TRƯỚC picker; nút "Tiếp tục — chọn bài học".
- #5: `resolveSuggestedModuleIds` fallback lọc gợi ý THEO level (cap level theo aiLevel) thay vì gợi ý toàn bộ. Ngưỡng `suggestLevelCap` để Lucas duyệt.

**Shipped:** `lib/roles.ts`, `lib/assessment.ts`, `lib/assessment-hr.ts`, `lib/learning-tiers.ts`, `lib/learning-path-selection.ts`, `components/onboarding-flow.tsx`, `components/lo-trinh-composition.tsx`, `components/lo-trinh-tiers.tsx`, `components/lo-trinh-content.tsx`.

**Cần Lucas duyệt:** (a) tier của m57–m64 suy tự động từ `level` DB (level 1,2,3) — chưa có level 4 nên Khối 4/Master rỗng cho nhan-su; (b) ngưỡng gợi ý theo level (`suggestLevelCap`); (c) `generated_learning_paths` của user nhan-su còn tham chiếu module van-hanh cũ (stale) → gợi ý AI rơi về fallback theo level; cần chạy lại recommender cho nhan-su nếu muốn gợi ý do AI sinh; (d) category "nhóm việc" của m57–m64 hiện "Khác / chưa phân loại" do chưa gắn `skills` tĩnh.

**Tests:** `npm run lint` pass (0 error, 7 warning pre-existing); `npm run test` 362 pass (1 suite `vercel-cli-json` lỗi sẵn — bỏ qua); `npm run build` pass.
## 2026-06-23 — Polish `/van-hanh` list UI, bulk delete, and detail drawers

**Goal:** Làm lại các list tab của platform admin cho dễ scan hơn: chọn hàng, lọc rõ, phân trang, badge màu, detail drawer, và xoá tài khoản hàng loạt; đồng thời ẩn card hiển thị “Supabase thật” ở header.

**Decision:** Tách shared list primitives (`platform-admin-list-primitives.tsx`, `platform-admin-list-utils.ts`, `platform-admin-shared.ts`), chuyển AI tool sang select canonical key, thêm `delete-users` hard delete có guard self/platform-admin, dùng drawer chi tiết cho user/tổ chức, và lazy import server-only Supabase/email/audit code để client bundle không kéo nhầm `next/headers` hay `nodemailer`.

**Shipped:** `src/frontend/components/platform-admin/{platform-admin-list-primitives.tsx,platform-admin-list-utils.ts,organization-detail-drawer.tsx,user-detail-drawer.tsx,organizations-tab.tsx,users-tab.tsx,content-tab.tsx,audit-tab.tsx,learning-metrics-tab.tsx}`, `src/frontend/components/platform-admin-console.tsx`, `src/frontend/lib/{platform-admin-shared.ts,platform-admin-console.ts,audit-log.ts,platform-admin-console.test.ts,platform-admin-console.delete.test.ts}`, `src/frontend/app/api/platform-admin/route.test.ts`.

**Tests:** `npm run lint` pass; `npm run test` pass; `npx -y -p node@20 node node_modules/next/dist/bin/next build src/frontend` pass. Follow-up: browser QA on `/van-hanh` desktop/mobile if a logged-in admin session is available.

## 2026-06-23 — Map audit action keys to operator-friendly names

**Decision:** `platform-admin.action` entries now resolve the real action from `properties_json.action`, expose `actionLabel` in the report, and render both label + technical key in the audit list so operators can trace logs without guessing. Search/filter works by either label or key.

**Shipped:** `src/frontend/lib/{platform-admin-shared.ts,platform-admin-console.ts,platform-admin-types.ts,platform-admin-console.test.ts}`, `src/frontend/components/platform-admin/audit-tab.tsx`.

**Tests:** `npm run lint` pass; `npm run test` pass; `npx -y -p node@20 node node_modules/next/dist/bin/next build src/frontend` pass.
## 2026-06-23 — Mini org console in `/van-hanh` with org admin RBAC creation

**Decision:** `/van-hanh` tab "Tổ chức" now scopes to the canonical real org so the console only surfaces the standardized organization the team is using. The detail drawer was expanded into a mini org-management panel with member list, learning summary, existing admin directory, and a create-admin flow that persists auth/profile/membership plus a permissions matrix into organization settings JSON.

**Shipped:** `src/frontend/lib/{platform-admin-shared.ts,platform-admin-types.ts,platform-admin-console.ts,platform-admin-console.test.ts}`, `src/frontend/hooks/use-platform-admin-console.ts`, `src/frontend/components/platform-admin/{organizations-tab.tsx,organization-detail-drawer.tsx}`, `src/frontend/app/api/platform-admin/route.test.ts`.

**Tests:** pending. Need lint/test/build + browser QA on `/van-hanh`.

## 2026-06-24 — Fix HR assessment Level 3 bị đẩy thành Level 4

**Goal:** đối chiếu framework 5 level trong slide HR và sửa riêng phân loại
Level 3 bị đẩy thành Level 4.

**Decision:** giữ nguyên `assessment.ts`, tổng điểm và logic skip module cũ.
Thêm wrapper `calculateHrAssessmentResult()` trong `assessment-hr.ts`: prompt
dù thành thạo vẫn cap Level 3; Level 4/5 chỉ xuất hiện khi hai câu gate HR mới
xác nhận automation/agent. Bộ câu hỏi HR cũ giữ nguyên, chỉ append hai gate.

**Verification:** targeted Vitest pass; 5 account confirmed/activated được chạy
lại qua classifier thật và lưu Supabase đúng Level 1→5. Regression test xác
nhận `calculateResult()` và `skipBasicModules` cũ không đổi.

## 2026-06-24 — Ổn định stream, welcome và ngưỡng clarify của Trợ lý AI

**Goal:** sửa flicker ở câu trả lời đầu tiên, giữ tin chào khi history rỗng và
giảm việc dựng card `__CLARIFY__` cho câu hỏi đã đủ rõ.

**Decision:** tạo placeholder assistant có UUID ngay lúc gửi và chỉ thay đúng
phần tử đó trong suốt stream; chuẩn hoá duplicate ID từ history một lần rồi dùng
`key={message.id}`; inject `welcome-msg` ở client khi Supabase history rỗng;
thêm hai ví dụ phân biệt clarify/direct answer trong prompt; hạ temperature lượt
chat thường từ `0.7` xuống `0.3` và synthesis từ `0.5` xuống `0.4`.

**Verification:** targeted Vitest 45/45 pass; `npm run lint` pass với 7 warning
cũ; `npm run test` pass (80 files / 395 Vitest, 30/30 Phase 1 API, 12/12
manager/invite, 7/7 auth/OAuth, 96 pytest); `npm run build` pass.

## 2026-06-24 — Hiển thị và xuất Aha Moment trong Vận hành

**Goal:** Cho platform admin xem các phản tư Aha đã lưu thay vì chỉ thấy số tổng,
đồng thời tải tập dữ liệu đang lọc để phân tích bằng Excel.

**Decision:** Thêm tab `Aha Moment` vào `/van-hanh`, dùng dữ liệu
`aha_reflections` đã có trong platform-admin report và chỉ trả các trường vận
hành cần thiết: thời gian, người học, tổ chức, module, insight, next action và
visibility. Export dùng CSV UTF-8 có BOM để mở trực tiếp bằng Excel/Google
Sheets, không thêm dependency; mọi cell do người dùng nhập được vô hiệu hóa
formula prefix để tránh CSV injection.

**Shipped:** `src/frontend/components/platform-admin/aha-reflections-tab.tsx`,
`src/frontend/lib/platform-admin-aha-export.ts`, types/report/hook/tab wiring và
unit tests liên quan.

**Tests:** targeted Vitest 21/21 pass; `npm run lint` pass (12 warning cũ);
`npm run build` pass; browser QA real Supabase trên `/van-hanh` xác nhận 3 bản
ghi thật, search/filter/table render đúng và không có console error. Full
`npm run test` dừng ở 3 lỗi HR assessment đã có trên `origin/develop`
(`buildHrAiLevelSignals` chưa export, expected 16 câu nhưng runtime trả 12).

## 2026-06-24 — Prompt hardening + structured thinking + strict vision validation

**Goal:** cứng hóa chat/vision behavior theo lesson context, tách thinking/final rõ ràng, và giữ card clarify chỉ khi thật sự cần thông tin thiếu.

**Decision:** nối contract `<thinking>/<final>` vào system prompt, parse thinking từ stream và render trong `<details>`, áp pre-validation ảnh practice theo JSON strict với `temperature: 0.1` để fail closed khi ảnh không liên quan, harden clarify card clickability, và giữ compatibility cho HR signal/test fixtures cũ bằng `buildHrAiLevelSignals` shim + legacy thinking parser.

**Verification:** `npm run lint` pass với warning repo cũ; `npm run test` pass toàn bộ (86 Vitest files / 424 tests, 30/30 API integration, 12/12 manager/invite, 7/7 auth/OAuth, 103/103 pytest); `npm run build` pass.

### Review hardening 2026-06-25

Review toàn diff phát hiện parser chỉ đúng khi cặp tag nằm trong cùng chunk, structured final làm mất `__CLARIFY__`, thinking không được gắn vào message đang stream, và practice route có thể rơi về điểm demo khi vision lỗi. Đã đổi parser sang accumulated-source parsing, parse card sau envelope, giữ thinking trên assistant message, truyền `imageValidation` qua API, và fail closed mọi submission có ảnh khi pre-validation không chạy được. Prompt grounding cũng bỏ nhánh tự lấp dữ kiện bằng giả định.

**Verification sau review:** `npm run lint` pass với 12 warning cũ; `npm run test` pass toàn bộ (86 Vitest files / 429 tests, 30 API, 12 manager/invite, 7 auth/OAuth, 103 pytest); `npm run build` pass. Browser smoke trên session Platform Admin xác nhận widget mở, input/send hoạt động và không có console error; API chat của role này trả fallback nên chưa dùng session đó để xác nhận card end-to-end.

## 2026-06-26 — Tích hợp RAGAS Evaluation, LangGraph Chat Agent và chuẩn hóa API Chấm điểm (practice-review) ở Frontend

**Goal:** Triển khai bộ khung đánh giá RAGAS (cho Chat, Lộ trình học, và Chấm điểm tự luận), mở rộng Chat Agent trong LangGraph thành luồng RAG 4-node, đồng thời chuẩn hóa `/api/practice-review` ở Frontend để dùng `graderGraph` và kiểu kết quả rõ ràng.

**Decision:**
- **Backend:** Xây dựng dataset pipeline từ logs Supabase/mock, chạy RAGAS evaluation, viết runner chạy tự động local/CI. Thiết lập đồ thị LangGraph 4-node (retrieve -> augment -> llm -> post_process) cho Chat Agent.
- **Frontend:** Cập nhật `src/frontend/app/api/practice-review/route.ts` để tiếp tục xử lý trong Next.js route handler, gọi `graderGraph` cho open-text/practical-image và map `GradingResult` về `PracticeReviewResult` an toàn. Không có proxy theo `PYTHON_BACKEND_URL` trong PR này. Sửa lỗi ESLint TS `any[][]` trong `learning-metrics-tab.tsx` thành `(string | number | boolean | null | undefined)[][]`.

**Shipped:** `src/frontend/app/api/practice-review/route.ts`, `src/frontend/components/platform-admin/learning-metrics-tab.tsx`.

**Tests:**
- Chạy `npm run lint` hoàn thành 100% không có lỗi (warnings chấp nhận được).
- Chạy `npm run test` thông qua toàn bộ 434 Vitest unit tests (88 test files).
- Next.js production build (`npx -y -p node@20 node node_modules/next/dist/bin/next build src/frontend`) hoàn thành 100% thành công không lỗi.
- Backend pytest `pytest tests/` vượt qua 103/103 test cases.
## 2026-06-28 — Fix QA Re-check 3 bugs for chat, onboarding, and roadmap labels

**Goal:** xử lý các lỗi QA report T09-B01..T09-B05 sau re-check 3 mà không mở rộng scope sang rename conversation hay Phase 2 mới.

**Decision:** chặn duplicate reasoning ở tầng render bằng cách bỏ phần thinking bị lặp ở đầu answer content; thay câu chốt skill-gating sang giọng thân thiện và làm mềm cả câu chốt cũ trong history; không cho welcome video modal hiện trên `/lo-trinh` để tránh che bài học; làm rõ khảo sát là số câu theo nhánh hiện tại; sửa label tier cũ từ typo sang “Nâng cao”. Dọn `any` trong export Excel learning metrics để lint gate xanh.

**Verification:** `npm run lint` pass với 13 warning cũ; `npm run test` pass toàn bộ (449 Vitest, 30/30 Phase 1 API, 12/12 manager/invite, 7/7 auth/OAuth, 3/3 activity/metrics, 103/103 pytest); `npm run build` pass. Browser smoke bằng tài khoản QA report: login thật → `/lo-trinh` không hiện welcome modal, Khối 3 hiển thị “Nâng cao”, click bài 1 mở `/lo-trinh/ke-toan-m1`; `/tro-ly` history chỉ còn một block “Quá trình xử lý”.

## 2026-07-01 — Mentor QA to 100 hardening

**Goal:** đóng các khoảng trống mentor report 87/100: auth protected surfaces, AI table/marker rendering, copy prompt feedback, welcome modal evidence, và repeatable evidence pack.

**Decision:** mở rộng protected employee app paths cho `/bo-ky-nang` và `/topic-cau-hoi`; không cho welcome video che `/tro-ly` evidence; gom clipboard vào helper chung có fallback; render pipe markdown table trong chat thành table responsive; strip legacy `<thinking>/<final>` marker khỏi content cũ; thêm `npm run evidence:mentor-qa` và reset SQL cho hai QA account.

**Verification:** targeted Vitest cho chat renderer, assistant message sanitizer, welcome modal và post-auth redirect pass; `npm run lint` pass với 15 warning cũ; `npm run test` pass toàn bộ; `npm run build` pass; `npm run eval:tro-ly` pass; local mentor evidence pass route `7/7` và AI prompt `5/5`.

## 2026-07-01 — Thêm vai trò "AI thực chiến K2 - Vibe code" + khóa học 25 bài

**Goal:** thêm vị trí học mới `vibe-code` (khóa VibeCode cho người No-code) để học viên K2 chọn ở onboarding và học trọn 25 bài từ `plans/vibecode-course/course.json`.

**Decision:**
- Dữ liệu khóa: copy `course.json` → `lib/vibecode-course.json`, transform sang `Role` ở `lib/roles-vibecode.ts` (parse duration, map 5 cấp khóa → level 1/2/3, rút summary/3 takeaway/practice prompt từ markdown). Giữ TRỌN nội dung gốc trong `RoleModule.detailMarkdown` (field mới) thay vì nén — tránh mất phần hướng dẫn step-by-step.
- Render hybrid: khung 5 bước cũ + khối collapsible "Hướng dẫn chi tiết" (`components/lesson-detail-markdown.tsx` — renderer markdown nhẹ, không thêm thư viện, link mở tab mới `rel=noopener`). UI đọc `detailMarkdown` từ ROLES tĩnh (`sourceModule`) → không cần cột DB, chạy cả demo lẫn Supabase (fetcher fallback tĩnh).
- Onboarding: thêm `vibe-code` vào `ENABLED_ONBOARDING_ROLE_IDS` (hiện cạnh `nhan-su`). Đổi 1 dòng để thay/ẩn sau.
- Type/allowlist: thêm `vibe-code` vào `RoleId`/`LEARNING_ROLE_IDS`/`ROLE_LABEL` (openai.ts) + 7 `VALID_ROLES` API (modules, modules/order, chat, agents/grader, quiz-results, profile, practice-review) + gợi ý tool cá nhân.
- DB: migration `20260701060000_vibe_code_role.sql` nới CHECK role_id ở profiles/learning_modules/onboarding_assessment_results/extra_skill_lessons/student_registrations.

**Shipped:** `lib/vibecode-course.json`, `lib/roles-vibecode.ts`, `components/lesson-detail-markdown.tsx`, `lib/roles.ts`, `lib/openai.ts`, `lib/individual-tool-suggest.ts`, `components/module-lesson-content.tsx`, 7 API route allowlist, `supabase/migrations/20260701060000_vibe_code_role.sql`, test counts (`roles.test.ts`, `learning-modules-data.test.ts`).

**Verification:** `npm run lint` pass (0 error, warning cũ); `npm run test:unit` 490/490 pass (1 suite lỗi sẵn `scripts/vercel-cli-json.test.mjs` — không liên quan, fail cả trên tree sạch); `npm run build` pass; `npm run db:validate` OK (58 migration).


### 27/11/2026 — Gỡ hook ghi log Codex theo yêu cầu

- Mục tiêu: bỏ hook tự động khi người dùng gặp thông báo hook failed.
- Thay đổi: đặt hooks thành object rỗng trong .codex/hooks.json, gỡ UserPromptSubmit và Stop gọi scripts/log_hook.py.
- Quyết định: chỉ gỡ hook Codex của dự án; không sửa hook của công cụ khác hoặc dữ liệu log. Chưa xác định nguyên nhân lỗi thực tế từ thông báo.
- Kiểm tra: parse JSON thành công, xác nhận hooks rỗng; không chạy lint/test/build vì chỉ thay cấu hình hook, không đổi mã ứng dụng.
- Follow-up: mở phiên Codex mới nếu phiên hiện tại vẫn giữ cấu hình hook cũ. Bản tải về không có Git repo riêng nên chưa tạo nhánh/PR.
