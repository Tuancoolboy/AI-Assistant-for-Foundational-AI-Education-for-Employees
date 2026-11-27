// Bộ câu hỏi khảo sát ĐẦU VÀO riêng cho vai trò "vibe-code" (Học viên K2 —
// chương trình "AI thực chiến" của VinUni). Học viên học BUILD APP bằng AI nên
// bộ câu chung (hỏi vị trí công việc, ngành nghề, việc hằng ngày) không hợp.
//
// THIẾT KẾ — 11 câu, chia 2 nhóm:
//  A) ĐO LEVEL (6 câu, có `score`): nền tảng code, terminal, đã dùng AI agent,
//     từng build/deploy chưa, kỹ năng prompt → quy ra aiLevel 0-4.
//  B) KHAI THÁC KHÓ KHĂN & BỐI CẢNH (5 câu, score 0): công cụ code đang dùng,
//     mục tiêu build, khó khăn lớn nhất, cách xử lý khi bị kẹt, nỗi lo khi học
//     → chỉ để cá nhân hóa & lưu hồ sơ, KHÔNG đẩy điểm level.
//
// CHẤM ĐIỂM: dùng chung engine calculateResult(answers, questions). Tổng điểm
// tối đa nhóm A = 22 → aiLevel tối đa 4 (< 5) → KHÔNG bao giờ tự skip bài Cấp 1
// (khóa nên học tuần tự từ đầu cho cả lớp). Mọi option nhóm B để score 0.

import type { AssessmentQuestion } from "@/lib/assessment";
// Nguồn sự thật duy nhất của id vai trò ở roles-vibecode (tránh trùng hằng số).
export { VIBE_CODE_ROLE_ID } from "./roles-vibecode";

export const VIBECODE_ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // ---- Nhóm A: đo LEVEL (có chấm điểm) --------------------------------------
  {
    id: "q-vc-built",
    title: "Bạn đã từng tự làm ra một sản phẩm số (web/app/tự động hóa) chưa?",
    helper: "Chọn mức gần đúng nhất — không có đáp án đúng/sai.",
    type: "likert",
    options: [
      { value: "never", label: "Chưa bao giờ", score: 0 },
      { value: "tutorial", label: "Mới làm theo hướng dẫn/tutorial", score: 1 },
      { value: "nocode", label: "Đã thử công cụ no-code (Wix, Canva...)", score: 2 },
      { value: "with-help", label: "Đã làm được nhưng cần người hỗ trợ", score: 3 },
      { value: "shipped", label: "Đã tự làm & đưa lên mạng cho người khác dùng", score: 4 },
    ],
  },
  {
    id: "q-vc-coding",
    title: "Nền tảng lập trình của bạn tới đâu?",
    type: "likert",
    options: [
      { value: "none", label: "Chưa biết gì về code", score: 0 },
      { value: "read", label: "Có đọc qua, hiểu lơ mơ", score: 1 },
      { value: "basic", label: "Biết cơ bản (sửa được code có sẵn)", score: 2 },
      { value: "comfortable", label: "Tự viết được chương trình nhỏ", score: 4 },
      { value: "pro", label: "Lập trình là công việc/sở trường của tôi", score: 5 },
    ],
  },
  {
    id: "q-vc-terminal",
    title: "Bạn quen dùng Terminal / dòng lệnh (command line) tới đâu?",
    helper: "Đây là ô gõ lệnh — sẽ dùng nhiều khi làm việc với AI agent.",
    type: "likert",
    options: [
      { value: "never", label: "Chưa nghe tới bao giờ", score: 0 },
      { value: "heard", label: "Có nghe nhưng chưa dùng", score: 1 },
      { value: "copy", label: "Biết copy-paste lệnh người khác đưa", score: 2 },
      { value: "daily", label: "Dùng được vài lệnh cơ bản, khá thoải mái", score: 3 },
    ],
  },
  {
    id: "q-vc-agent",
    title: "Bạn đã dùng AI coding agent (Claude Code, Cursor, Copilot...) chưa?",
    type: "likert",
    options: [
      { value: "never", label: "Chưa bao giờ", score: 0 },
      { value: "heard", label: "Mới nghe tên", score: 1 },
      { value: "tried", label: "Đã cài thử 1-2 lần", score: 2 },
      { value: "sometimes", label: "Thỉnh thoảng dùng để làm việc", score: 4 },
      { value: "regular", label: "Dùng thường xuyên để build sản phẩm", score: 5 },
    ],
  },
  {
    id: "q-vc-editor",
    title: "Bạn thường dùng công cụ nào để code? (chọn nhiều)",
    helper: "Giúp hướng dẫn thao tác đúng công cụ bạn đang dùng — không tính điểm.",
    type: "multi-chip",
    options: [
      { value: "vscode", label: "VS Code", score: 0 },
      { value: "cursor", label: "Cursor", score: 0 },
      { value: "antigravity", label: "Antigravity (Google)", score: 0 },
      { value: "windsurf", label: "Windsurf", score: 0 },
      { value: "jetbrains", label: "JetBrains (WebStorm, PyCharm...)", score: 0 },
      { value: "online-ide", label: "IDE online (Replit, CodeSandbox...)", score: 0 },
      { value: "none", label: "Chưa dùng công cụ code nào", score: 0 },
    ],
  },
  {
    id: "q-vc-deploy",
    title: "Bạn đã từng đưa một sản phẩm lên internet (deploy, có link chia sẻ) chưa?",
    type: "likert",
    options: [
      { value: "no-idea", label: "Chưa biết deploy là gì", score: 0 },
      { value: "heard", label: "Biết khái niệm nhưng chưa làm", score: 1 },
      { value: "with-help", label: "Đã deploy được khi có hướng dẫn", score: 2 },
      { value: "self", label: "Tự deploy được (Vercel, Netlify...)", score: 3 },
    ],
  },
  {
    id: "q-vc-prompt",
    title: "Mức độ tự tin của bạn khi viết prompt (ra lệnh) cho AI?",
    helper: "Tự đánh giá thật — không có đáp án đúng/sai.",
    type: "likert",
    options: [
      { value: "0", label: "Chưa biết viết prompt sao cho hiệu quả", score: 0 },
      { value: "1", label: "Hỏi được cơ bản, kết quả tạm", score: 1 },
      { value: "2", label: "Biết mô tả bối cảnh + yêu cầu cụ thể, rõ ràng", score: 2 },
    ],
  },

  // ---- Nhóm B: khai thác KHÓ KHĂN & bối cảnh (score 0) ----------------------
  {
    id: "q-vc-goal",
    title: "Bạn muốn dùng vibe coding để làm gì? (chọn nhiều)",
    helper: "Giúp gợi ý ví dụ sát mục tiêu của bạn — không tính điểm.",
    type: "multi-chip",
    options: [
      { value: "landing", label: "Trang giới thiệu / landing page", score: 0 },
      { value: "webapp", label: "App web có dữ liệu & người dùng", score: 0 },
      { value: "automation", label: "Tự động hóa công việc của tôi", score: 0 },
      { value: "startup", label: "Sản phẩm khởi nghiệp / đồ án", score: 0 },
      { value: "learn", label: "Học cho biết, chưa có dự án cụ thể", score: 0 },
      { value: "unsure", label: "Chưa rõ, muốn khám phá", score: 0 },
    ],
  },
  {
    id: "q-vc-struggles",
    title: "Khó khăn lớn nhất của bạn khi tự build/học code với AI là gì? (chọn nhiều)",
    helper: "Giúp lộ trình tập trung gỡ đúng chỗ bạn hay kẹt.",
    type: "multi-chip",
    options: [
      { value: "start", label: "Không biết bắt đầu từ đâu", score: 0 },
      { value: "setup", label: "Cài đặt môi trường / công cụ rắc rối", score: 0 },
      { value: "error", label: "Gặp lỗi mà đọc không hiểu", score: 0 },
      { value: "prompt", label: "Ra lệnh cho AI nhưng nó làm chưa đúng ý", score: 0 },
      { value: "blackbox", label: "Code chạy được nhưng không hiểu nó làm gì", score: 0 },
      { value: "deploy", label: "Đưa sản phẩm lên mạng (deploy) khó", score: 0 },
      { value: "stuck-alone", label: "Bí mà không có ai để hỏi", score: 0 },
      { value: "motivation", label: "Khó duy trì động lực / dễ bỏ giữa chừng", score: 0 },
    ],
  },
  {
    id: "q-vc-stuck",
    title: "Khi app báo lỗi hoặc bạn bị kẹt, bạn thường xử lý thế nào?",
    helper: "Không tính điểm — chỉ để hiểu cách bạn học.",
    type: "likert",
    options: [
      { value: "give-up", label: "Thường để đó / bỏ cuộc", score: 0 },
      { value: "ask-people", label: "Chờ hỏi bạn bè / người hướng dẫn", score: 0 },
      { value: "copy-ai", label: "Copy lỗi dán cho AI hỏi cách sửa", score: 0 },
      { value: "read-try", label: "Tự đọc thông báo lỗi rồi thử sửa", score: 0 },
      { value: "debug", label: "Tự lần từng bước để tìm nguyên nhân", score: 0 },
    ],
  },
  {
    id: "q-vc-worry",
    title: "Điều bạn lo nhất khi bắt đầu học vibe code là gì? (chọn nhiều)",
    helper: "Không tính điểm — giúp trợ lý AI hỗ trợ bạn đúng nỗi lo.",
    type: "multi-chip",
    options: [
      { value: "keep-up", label: "Sợ không theo kịp lớp", score: 0 },
      { value: "no-base", label: "Sợ mình không có nền tảng code", score: 0 },
      { value: "blackbox", label: "Sợ dùng được nhưng không hiểu bản chất", score: 0 },
      { value: "ai-wrong", label: "Sợ AI làm sai mà mình không biết", score: 0 },
      { value: "cost", label: "Sợ tốn tiền (gói AI, hosting...)", score: 0 },
      { value: "time", label: "Sợ không đủ thời gian thực hành", score: 0 },
    ],
  },
];
