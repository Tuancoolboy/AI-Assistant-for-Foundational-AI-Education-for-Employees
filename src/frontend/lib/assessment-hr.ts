// ============================================================================
// BÀI KHẢO SÁT CHẨN ĐOÁN HR (Giai đoạn 2) — hiển thị SAU khi chọn vai trò "nhan-su"
// ----------------------------------------------------------------------------
// Mục đích: hiểu rõ từng học viên đang làm gì + muốn AI hóa việc nào, để AGENT
// dựng lộ trình học sát nhất. Câu hỏi cốt lõi (q3hr-tasks) cho học viên chọn các
// SLUG NHÓM VIỆC trùng với `skills` của bài học (roles-hr.ts) → Agent join để lọc.
//
// Tương thích hệ thống Phase 1:
//  - Chỉ dùng type "likert" | "multi-chip" (UI onboarding hỗ trợ sẵn).
//    Câu "free-text" (q-hr-recurring) là TÙY CHỌN, cần thêm 1 nhánh textarea
//    vào StepAssessment — xem docs/hr-phase2/README-TICH-HOP.md.
//  - Bộ câu hỏi, điểm raw và logic skip module cũ được giữ nguyên.
//  - Riêng nhãn AI level HR được tính lại bằng capability gate ở cuối file.
//
// CÁCH DÙNG: thay vì render thẳng ASSESSMENT_QUESTIONS, gọi
//   getAssessmentQuestionsForRole(roleId)
// và sau khi xong gọi extractHrSignals(answers) để lấy tín hiệu cho Agent.
// ============================================================================

import {
  ASSESSMENT_QUESTIONS,
  calculateResult,
  type AssessmentAnswer,
  type AssessmentQuestion,
  type AssessmentResult,
} from "./assessment";
import type { AiLevelSignals } from "./assessment-level-agent";
import { HR_TASK_CATEGORIES } from "./roles-hr";
import {
  VIBE_CODE_ROLE_ID,
  VIBECODE_ASSESSMENT_QUESTIONS,
} from "./assessment-vibecode";

export const HR_ROLE_ID = "nhan-su";

// --- Câu hỏi đặc thù HR (roleFilter: nhan-su) — bộ "đào sâu" 15 câu + 1 câu mở -
// Nguồn: specs/HR-assessment-15-questions.md. Chỉ Q4-kinh-nghiệm, Q8 (tần suất AI),
// Q9 (đã dùng AI cho HR), Q10 (prompt), Q11 (an toàn dữ liệu) đóng góp điểm aiLevel;
// các câu bối cảnh score 0 nên KHÔNG làm lệch level.
export const HR_ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // ===== NHÓM A — Bối cảnh nghề HR =====
  {
    id: "q-hr-subfunction",
    title: "Mảng HR chính của bạn hiện tại là gì?",
    helper: "Chọn 1 mô tả gần nhất — để lộ trình ưu tiên đúng nghiệp vụ của bạn.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "tuyen-dung", label: "Tuyển dụng (Recruiter / TA)", score: 0 },
      { value: "tong-hop", label: "HR tổng hợp (làm nhiều mảng)", score: 0 },
      { value: "cb-luong", label: "C&B / Tính lương & phúc lợi", score: 0 },
      { value: "ld-dao-tao", label: "Đào tạo / L&D", score: 0 },
      { value: "hrbp-quan-ly", label: "HRBP / Quản lý / Giám đốc nhân sự", score: 0 },
      { value: "hanh-chinh", label: "Hành chính nhân sự / HR Ops", score: 0 },
    ],
  },
  {
    id: "q-hr-company-size",
    title: "Quy mô công ty bạn?",
    helper: "Quy mô ảnh hưởng tới mức độ cần tự động hóa.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "lt50", label: "Dưới 50 nhân viên", score: 0 },
      { value: "50-100", label: "50 – 100 nhân viên", score: 0 },
      { value: "100-200", label: "100 – 200 nhân viên", score: 0 },
      { value: "gt200", label: "Trên 200 nhân viên", score: 0 },
    ],
  },
  {
    id: "q-hr-industry",
    title: "Công ty bạn thuộc ngành nào?",
    helper: "Để ví dụ trong bài học sát ngành của bạn.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "ban-le", label: "Bán lẻ / Thương mại điện tử", score: 0 },
      { value: "dich-vu", label: "Dịch vụ (F&B, spa, giáo dục...)", score: 0 },
      { value: "san-xuat", label: "Sản xuất / Phân phối", score: 0 },
      { value: "cong-nghe", label: "Công nghệ / Phần mềm", score: 0 },
      { value: "khac", label: "Khác / Tổng hợp", score: 0 },
    ],
  },
  {
    id: "q-hr-experience",
    title: "Số năm kinh nghiệm làm HR của bạn?",
    helper: "Giúp điều chỉnh độ sâu nội dung.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "lt1", label: "Dưới 1 năm", score: 1 },
      { value: "1-3", label: "1 – 3 năm", score: 2 },
      { value: "3-5", label: "3 – 5 năm", score: 3 },
      { value: "gt5", label: "Trên 5 năm", score: 4 },
      { value: "quan-ly", label: "Cấp quản lý nhân sự", score: 5 },
    ],
  },
  {
    // CÂU CỐT LÕI — feed dailyTasks/goalTags. value = slug trùng skills bài học.
    id: "q3hr-tasks",
    title: "Bạn muốn Claude/AI giúp những việc HR nào? (chọn nhiều)",
    helper: "Đây là tín hiệu chính để dựng lộ trình. Chọn tất cả việc bạn muốn AI hóa.",
    type: "multi-chip",
    roleFilter: [HR_ROLE_ID],
    options: HR_TASK_CATEGORIES.map((c) => ({ value: c.slug, label: c.label })),
  },
  {
    id: "q-hr-priority",
    title: "Trong các việc đó, việc nào NGỐN THỜI GIAN NHẤT — ưu tiên giải quyết trước?",
    helper: "Chọn 1 — Agent sẽ đặt bài liên quan lên đầu lộ trình.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: HR_TASK_CATEGORIES.map((c) => ({
      value: c.slug,
      label: c.label,
      score: 0,
    })),
  },
  {
    id: "q-hr-data",
    title: "Bạn có thường xuyên xử lý dữ liệu nhạy cảm (lương, hợp đồng, hồ sơ, CCCD)?",
    helper: "Để chương trình nhấn mạnh đúng mức phần an toàn dữ liệu nhân sự.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "sang-loc-cv", label: "Sàng lọc CV / tuyển dụng" },
      { value: "soan-email", label: "Soạn email & văn bản" },
      { value: "cham-cong-luong", label: "Chấm công / tính lương" },
      { value: "bao-cao", label: "Làm báo cáo, số liệu" },
      { value: "hoi-dap-nv", label: "Trả lời câu hỏi của nhân viên" },
      { value: "quy-trinh", label: "Soạn quy trình / chính sách" },
    ],
  },
  {
    id: "q-hr-current-tools",
    title: "Bạn đang dùng công cụ gì cho việc HR? (chọn nhiều)",
    type: "multi-chip",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "excel", label: "Excel / Google Sheets" },
      { value: "hrm", label: "Phần mềm HRM (Base, Misa, ...)" },
      { value: "word", label: "Word / soạn thảo" },
      { value: "email", label: "Email" },
      { value: "thu-cong", label: "Giấy tờ / thủ công" },
    ],
  },
  // ===== NHÓM B — Trình độ AI (tính level) =====
  {
    id: "q-hr-ai-usage",
    title: "Bạn đã dùng AI cho việc HR cụ thể nào chưa? (chọn nhiều)",
    helper: "Mỗi việc đã dùng giúp xếp đúng cấp lộ trình.",
    type: "multi-chip",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "soan-vb", label: "Soạn email / văn bản", score: 1 },
      { value: "sang-loc-cv", label: "Sàng lọc CV", score: 1 },
      { value: "tom-tat", label: "Tóm tắt tài liệu / biên bản", score: 1 },
      { value: "so-lieu", label: "Tính toán / xử lý số liệu", score: 1 },
      { value: "chua-dung", label: "Chưa dùng cho việc HR", score: 0 },
    ],
  },
  {
    id: "q-hr-prompt-skill",
    title: "Mức tự tin khi viết câu lệnh (prompt) cho AI?",
    helper: "Tự đánh giá thật — không có đáp án đúng/sai.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "0", label: "Không biết viết", score: 0 },
      { value: "1", label: "Mới làm quen", score: 1 },
      { value: "2", label: "Viết được cơ bản", score: 3 },
      { value: "3", label: "Viết tốt", score: 4 },
      { value: "4", label: "Rất thành thạo", score: 5 },
    ],
  },
  {
    id: "q-hr-data-knowledge",
  title:
    "Bạn có biết khi nào KHÔNG nên đưa dữ liệu (lương, CV, thông tin nhân viên) lên AI công cộng?",
  helper: "Để chương trình nhấn mạnh đúng mức phần an toàn dữ liệu.",
  type: "likert",
  roleFilter: [HR_ROLE_ID],
  options: [
    { value: "khong-biet", label: "Không biết", score: 0 },
    { value: "mo-ho", label: "Mơ hồ", score: 1 },
    { value: "co-ban", label: "Biết cơ bản", score: 3 },
    { value: "ro", label: "Biết rõ và luôn ẩn danh trước", score: 4 },
  ],
  },
  // ===== NHÓM C — Mục tiêu & cách học =====
  {
    id: "q-hr-goal",
    title: "Mục tiêu lớn nhất khi học AI cho HR?",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "tiet-kiem", label: "Tiết kiệm thời gian", score: 0 },
      { value: "giam-sai", label: "Giảm sai sót", score: 0 },
      { value: "nang-chat", label: "Nâng chất lượng công việc", score: 0 },
    { value: "xu-huong", label: "Theo kịp xu hướng", score: 0 },
  ],
  },
  {
    id: "q-hr-learn-style",
    title: "Bạn thích học theo kiểu nào?",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "thuc-hanh", label: "Thực hành ngay với ví dụ", score: 0 },
      { value: "ly-thuyet", label: "Hiểu lý thuyết trước", score: 0 },
      { value: "vua-hoc-vua-lam", label: "Vừa học vừa làm", score: 0 },
    ],
  },
  {
    id: "q-hr-time-week",
    title: "Bạn dành được bao nhiêu thời gian học mỗi tuần?",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "lt1h", label: "Dưới 1 giờ", score: 0 },
      { value: "1-2h", label: "1 – 2 giờ", score: 0 },
      { value: "2-4h", label: "2 – 4 giờ", score: 0 },
      { value: "gt4h", label: "Trên 4 giờ", score: 0 },
    ],
  },
  {
    id: "q-hr-difficulty",
    title: "Bạn từng gặp khó / sai sót khi dùng AI cho việc HR chưa?",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "chua-dung", label: "Chưa từng dùng", score: 0 },
      { value: "chua-gap", label: "Chưa gặp", score: 0 },
      { value: "vai-lan", label: "Có, vài lần", score: 0 },
      { value: "thuong-xuyen", label: "Có, khá thường xuyên", score: 0 },
    ],
  },
  // ===== CÂU MỞ =====
  {
    // Tín hiệu quý nhất cho Agent: mô tả việc thật bằng lời của học viên.
    id: "q-hr-recurring",
    title:
      "Ngoài những việc trên, công việc HR cụ thể nào khác bạn đang làm và muốn AI hỗ trợ?",
    helper:
      "Không bắt buộc. Ví dụ: 'Mỗi tuần sàng lọc ~40 CV vị trí sale', 'Cuối tháng làm báo cáo nhân sự cho sếp'.",
    type: "free-text",
    roleFilter: [HR_ROLE_ID],
  },
  {
    id: "q-hr-automation",
    title: "Bạn đã từng kết nối AI với công cụ khác để workflow tự chạy chưa?",
    helper: "Ví dụ: AI + Google Sheets/Lark/Zapier/n8n có trigger và output tự động.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "no", label: "Chưa", score: 0 },
      { value: "yes", label: "Đã tự xây và dùng trong công việc", score: 0 },
    ],
  },
  {
    id: "q-hr-agent",
    title: "Bạn đã từng build AI Agent tự thực thi nhiều bước chưa?",
    helper: "Agent phải tự gọi tool/theo dõi kết quả; không chỉ là một prompt hoặc chatbot.",
    type: "likert",
    roleFilter: [HR_ROLE_ID],
    options: [
      { value: "no", label: "Chưa", score: 0 },
      { value: "yes", label: "Đã build và trực tiếp giám sát agent", score: 0 },
    ],
  },
];

// --- Thứ tự câu hỏi cho học viên HR (tái dùng câu chung tính level) ----------
// Lấy q1 (thâm niên), q4 (tần suất AI), q5 (kỹ năng prompt), q6 (công cụ) từ bộ
// chung; chèn các câu HR. Bỏ q2-industry & q3-daily-tasks chung (đã có bản HR).
function genericById(id: string): AssessmentQuestion | undefined {
  return ASSESSMENT_QUESTIONS.find((q) => q.id === id);
}

/**
 * Trả về danh sách câu hỏi theo vai trò.
 * - "nhan-su": bộ "đào sâu" 15 câu + 1 câu mở (theo specs/HR-assessment-15-questions.md).
 * - vai trò khác: giữ nguyên 6 câu gốc.
 *
 * includeFreeText=false → loại câu mở khỏi luồng (vd nếu UI chưa hỗ trợ textarea).
 */
export function getAssessmentQuestionsForRole(
  roleId: string | null | undefined,
  includeFreeText = true,
): AssessmentQuestion[] {
  // Vai trò vibe-code (học viên K2) dùng bộ câu riêng đúng bối cảnh build app.
  if (roleId === VIBE_CODE_ROLE_ID) return VIBECODE_ASSESSMENT_QUESTIONS;
  if (roleId !== HR_ROLE_ID) return ASSESSMENT_QUESTIONS;

  const q1 = genericById("q1-position");
  const q4 = genericById("q4-ai-frequency");
  const q5 = genericById("q5-ai-skill");
  const q6 = genericById("q6-ai-tools");
  const hr = (id: string) => HR_ASSESSMENT_QUESTIONS.find((q) => q.id === id)!;

  const ordered: (AssessmentQuestion | undefined)[] = [
    q1,
    hr("q-hr-subfunction"),
    hr("q-hr-company-size"),
    hr("q3hr-tasks"),
    hr("q-hr-priority"),
    hr("q-hr-data"),
    q4,
    q5,
    q6,
    includeFreeText ? hr("q-hr-recurring") : undefined,
    hr("q-hr-automation"),
    hr("q-hr-agent"),
  ];

  return ordered.filter((q): q is AssessmentQuestion => Boolean(q));
}

const HR_LEVEL_META: Record<number, Pick<AssessmentResult, "levelLabel" | "levelDesc">> = {
  1: {
    levelLabel: "Biết AI",
    levelDesc: "Đã biết các công cụ AI tồn tại nhưng chưa dùng thành thạo trong công việc.",
  },
  2: {
    levelLabel: "Dùng AI cơ bản",
    levelDesc: "Đã dùng AI cho hỏi đáp hoặc tác vụ đơn giản nhưng output còn khá chung.",
  },
  3: {
    levelLabel: "Prompt cho công việc",
    levelDesc: "Đã biết viết prompt có bối cảnh, vai trò, định dạng và ràng buộc.",
  },
  4: {
    levelLabel: "Tự động hóa công việc",
    levelDesc: "Đã kết nối AI với công cụ khác để workflow có thể tự chạy.",
  },
  5: {
    levelLabel: "AI Agent",
    levelDesc: "Đã xây agent thực thi nhiều bước và gọi công cụ dưới sự giám sát.",
  },
};

/**
 * Chỉ override phân loại hiển thị/lưu DB cho HR.
 * `calculateResult` và totalScore cũ được giữ nguyên.
 * `skipBasicModules` được derive lại từ HR aiLevel (không dùng legacy score).
 *
 * Hai câu `q-hr-automation` và `q-hr-agent` là bằng chứng duy nhất cho Level
 * 4/5; không tự suy hai level này từ thâm niên, tool count hoặc tần suất dùng AI.
 *
 * Monotonic invariant: L5 ⊇ L4 ⊇ L3 ⊇ L2 ⊇ L1.
 * hasAgent=yes hàm ý đã có năng lực automation (L4) — decision tree short-circuit
 * ở `if (hasAgent) aiLevel = 5` trước khi check automation.
 */
export function calculateHrAssessmentResult(
  answers: AssessmentAnswer[],
): AssessmentResult {
  const legacyResult = calculateResult(answers);
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.value]));

  // dailyTasks (= nhóm việc chọn ở q3hr-tasks) là TÍN HIỆU phân bổ bài chính.
  // calculateResult dùng bộ câu hỏi generic nên KHÔNG nhận q3hr-tasks → tự rút ở đây,
  // nếu không lộ trình sẽ lấy toàn bộ kho thay vì đúng phần đã chọn.
  const tasksRaw = byId.get("q3hr-tasks");
  const dailyTasks = Array.isArray(tasksRaw)
    ? tasksRaw
    : tasksRaw
      ? [String(tasksRaw)]
      : legacyResult.dailyTasks;

  const promptSkill = String(byId.get("q5-ai-skill") ?? "0");
  const frequency = String(byId.get("q4-ai-frequency") ?? "never");
  const hasAutomation = byId.get("q-hr-automation") === "yes";
  const hasAgent = byId.get("q-hr-agent") === "yes";

  let aiLevel = 1;
  if (hasAgent) aiLevel = 5;
  else if (hasAutomation) aiLevel = 4;
  else if (promptSkill === "2" || promptSkill === "3" || promptSkill === "4") {
    aiLevel = 3;
  } else if (
    promptSkill === "1" ||
    frequency === "tried" ||
    frequency === "sometimes" ||
    frequency === "weekly" ||
    frequency === "daily"
  ) {
    aiLevel = 2;
  }

  return {
    ...legacyResult,
    aiLevel,
    skipBasicModules: aiLevel >= 5,
    dailyTasks,
    ...HR_LEVEL_META[aiLevel],
  };
}

// --- Tín hiệu HR rút ra từ câu trả lời (cho Agent dựng lộ trình) --------------
export type HrSurveySignals = {
  subFunction: string | null; // slug mảng HR (q-hr-subfunction)
  companySize: string | null; // lt50 | 50-100 | 100-200 | gt200
  tasks: string[]; // slug nhóm việc muốn AI hóa (q3hr-tasks) → goalTags
  priorityTask: string | null; // slug ưu tiên #1 (q-hr-timesink)
  dataSensitivity: string | null; // thuong-xuyen | thinh-thoang | hiem
  recurringTaskText: string | null; // mô tả tự do (q-hr-recurring)
};

function asString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Rút tín hiệu HR từ answers (độc lập với calculateResult).
 * Agent dùng `tasks` làm goalTags để join với module.skills trong roles-hr.ts,
 * đặt `priorityTask` lên đầu, và dùng `recurringTaskText` làm ngữ cảnh phong phú.
 */
export function extractHrSignals(answers: AssessmentAnswer[]): HrSurveySignals {
  const byId = new Map(answers.map((a) => [a.questionId, a.value] as const));
  const tasksRaw = byId.get("q3hr-tasks");
  const timesinkRaw = byId.get("q-hr-timesink");
  // priorityTask: việc tốn thời gian nhất (q-hr-timesink, multi) → lấy mục đầu.
  const priorityTask = Array.isArray(timesinkRaw)
    ? (timesinkRaw[0] ?? null)
    : asString(timesinkRaw);
  return {
    subFunction: asString(byId.get("q-hr-subfunction")),
    companySize: asString(byId.get("q-hr-company-size")),
    tasks: Array.isArray(tasksRaw) ? tasksRaw : tasksRaw ? [tasksRaw] : [],
    priorityTask,
    // Hiểu biết an toàn dữ liệu (q-hr-data-knowledge).
    dataSensitivity: asString(byId.get("q-hr-data-knowledge")),
    recurringTaskText: asString(byId.get("q-hr-recurring")),
  };
}

function mapAiFrequencyScore(value: unknown): number {
  switch (String(value ?? "").toLowerCase()) {
    case "daily":
      return 6;
    case "weekly":
      return 4;
    case "sometimes":
      return 2;
    case "tried":
      return 1;
    default:
      return 0;
  }
}

function mapPromptSkillScore(value: unknown): number {
  switch (String(value ?? "")) {
    case "4":
      return 7;
    case "3":
      return 4;
    case "2":
      return 3;
    case "1":
      return 1;
    default:
      return 0;
  }
}

function mapDataSafetyScore(value: unknown): number {
  switch (String(value ?? "").toLowerCase()) {
    case "thuong-xuyen":
    case "ro":
    case "cao":
    case "yes":
      return 4;
    case "thinh-thoang":
    case "vua-phai":
      return 2;
    case "hiem":
    case "thap":
      return 1;
    default:
      return 0;
  }
}

export function buildHrAiLevelSignals(
  answers: AssessmentAnswer[],
  heuristicLevel: number,
): AiLevelSignals {
  const byId = new Map(answers.map((a) => [a.questionId, a.value] as const));
  const tasksValue = byId.get("q3hr-tasks") ?? byId.get("q-hr-ai-usage");
  const toolsValue = byId.get("q6-ai-tools") ?? byId.get("q-hr-current-tools");
  const promptSkillValue = byId.get("q5-ai-skill") ?? byId.get("q-hr-prompt-skill");
  const frequencyValue = byId.get("q4-ai-frequency");

  return {
    aiFrequencyScore: mapAiFrequencyScore(frequencyValue),
    promptSkillScore: mapPromptSkillScore(promptSkillValue),
    aiToolsCount: Array.isArray(toolsValue) ? toolsValue.length : toolsValue ? 1 : 0,
    aiForHrCount: Array.isArray(tasksValue) ? tasksValue.length : tasksValue ? 1 : 0,
    dataSafetyScore: mapDataSafetyScore(
      byId.get("q-hr-data") ?? byId.get("q-hr-data-knowledge"),
    ),
    heuristicLevel,
  };
}

// Nhãn hiển thị cho slug nhóm việc (dùng ở StepResult nếu muốn).
export const HR_TASK_LABELS: Record<string, string> = Object.fromEntries(
  HR_TASK_CATEGORIES.map((c) => [c.slug, c.label]),
);
