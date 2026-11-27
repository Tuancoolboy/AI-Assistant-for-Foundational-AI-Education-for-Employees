// ============================================================================
// THƯ VIỆN BÀI HỌC VIBE CODE — vai trò "vibe-code"
// ----------------------------------------------------------------------------
// Khóa "Học viên K2 - Vibe Code" (AI thực chiến): dạy người No-code tự build & deploy app
// web thật bằng AI coding agent (Claude Code / Cursor). Nguồn nội dung:
// lib/data/vibecode-course.json (25 bài, 5 cấp) — chuyển thành RoleModule[].
//
// THIẾT KẾ: mỗi bài giữ TRỌN nội dung hướng dẫn chi tiết trong `detailMarkdown`
// (render ở khối "Hướng dẫn chi tiết" của màn bài học), đồng thời rút gọn thành
// summary + 3 điều cần nhớ + 1 prompt thực hành cho khung 5 bước.
//
// CÁCH DÙNG: import VIBE_CODE_ROLE và gắn vào ROLES trong lib/roles.ts:
//   import { VIBE_CODE_ROLE } from "./roles-vibecode";
//   export const ROLES = { ..., "vibe-code": VIBE_CODE_ROLE };
// ============================================================================

import type { Role, RoleModule } from "./roles";
import courseData from "./vibecode-course.json";

export const VIBE_CODE_ROLE_ID = "vibe-code";
export const VIBE_CODE_SKILL_SLUG = "vibe-code-khac";

// Nhóm kỹ năng gộp cho vai trò (1 nhóm/vai trò) — khớp quy ước non-HR ở roles.ts.
export const VIBE_CODE_SKILL_LABELS: Record<string, string> = {
  "vibe-code-khac": "Vibe coding — build app bằng AI",
};

type CourseLesson = {
  id: string;
  title: string;
  module?: string;
  duration?: string;
  isCapstone?: boolean;
  markdown: string;
};
type CourseLevel = { level: number; title: string; outcome: string; lessons: CourseLesson[] };
type Course = { slug: string; title: string; levels: CourseLevel[] };

const COURSE = courseData as Course;

// "~1.5 giờ" → 90, "~30 phút" → 30. Mặc định 60 nếu không đọc được.
function parseDurationMin(d?: string): number {
  if (!d) return 60;
  const m = d.match(/([\d.]+)\s*(giờ|phút)/);
  if (!m) return 60;
  const n = parseFloat(m[1]);
  return m[2] === "giờ" ? Math.round(n * 60) : Math.round(n);
}

// Cấp khóa học (0–4) → cấp module (1 nhập môn, 2 trung cấp, 3 nâng cao).
function mapLevel(courseLevel: number): 1 | 2 | 3 {
  if (courseLevel <= 1) return 1;
  if (courseLevel === 2) return 2;
  return 3;
}

// Tóm tắt = dòng "🎯 Mục tiêu" trong markdown bài học.
function extractSummary(md: string, fallback: string): string {
  const m = md.match(/🎯 \*\*Mục tiêu:\*\*\s*([^\n]+)/);
  const s = (m ? m[1] : "").replace(/\*\*/g, "").trim();
  return s.length >= 40 ? s : fallback;
}

const GENERIC_LEARNINGS = [
  "Nắm ý chính và làm theo được ngay trong bài",
  "Thực hành cùng AI coding agent thay vì học lý thuyết",
  "Ghi lại điều rút ra để áp dụng vào dự án của bạn",
];

// 3 điều cần nhớ: ưu tiên checkbox "✅ Tiêu chí hoàn thành", bù bằng bullet
// "🧠 Khái niệm cốt lõi", cuối cùng pad bằng GENERIC để luôn đủ 3.
function extractLearnings(md: string): string[] {
  const lines = md.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const cb = line.match(/^\s*-\s*\[\s*\]\s*(.+)/);
    if (cb) out.push(cb[1].replace(/\*\*/g, "").trim());
  }

  if (out.length < 3) {
    let inConcept = false;
    for (const line of lines) {
      if (/🧠 \*\*Khái niệm cốt lõi/.test(line)) {
        inConcept = true;
        continue;
      }
      if (inConcept) {
        if (/^\s*-\s*[🎯🛠️⚠️💬📚✅]/.test(line)) break;
        const b = line.match(/^\s{2,}-\s*(.+)/);
        if (b) {
          const text = b[1].replace(/\*\*/g, "").replace(/`/g, "").trim();
          if (text.length > 8) out.push(text);
        }
      }
    }
  }

  const cleaned = out.map((s) => (s.length > 120 ? s.slice(0, 117) + "…" : s));
  while (cleaned.length < 3) cleaned.push(GENERIC_LEARNINGS[cleaned.length]);
  return cleaned.slice(0, 3);
}

// Prompt thực hành = khối ``` đầu tiên sau mục "💬 Prompt mẫu".
function extractPracticePrompt(md: string): string | undefined {
  const idx = md.indexOf("Prompt mẫu");
  const region = idx >= 0 ? md.slice(idx) : md;
  const m = region.match(/```[^\n]*\n([\s\S]*?)```/);
  const prompt = m ? m[1].trim() : "";
  return prompt.length > 10 ? prompt : undefined;
}

function buildModules(): RoleModule[] {
  const modules: RoleModule[] = [];
  let n = 0;
  for (const level of COURSE.levels) {
    for (const lesson of level.lessons) {
      n += 1;
      const learnings = extractLearnings(lesson.markdown);
      modules.push({
        id: `vibe-code-m${n}`,
        title: lesson.title,
        durationMin: parseDurationMin(lesson.duration),
        level: mapLevel(level.level),
        skills: [VIBE_CODE_SKILL_SLUG],
        content: extractSummary(
          lesson.markdown,
          `Bài thực hành vibe coding: ${lesson.title}. ${learnings[0]}`,
        ),
        learnings,
        practicePrompt: extractPracticePrompt(lesson.markdown),
        // Giữ trọn nội dung hướng dẫn chi tiết để render ở khối riêng.
        detailMarkdown: lesson.markdown,
      });
    }
  }
  return modules;
}

export const VIBE_CODE_ROLE: Role = {
  id: VIBE_CODE_ROLE_ID,
  label: "Học viên K2 - Vibe Code",
  shortLabel: "Học viên K2 - Vibe Code",
  icon: "🧑‍💻",
  color: "#4F46E5",
  modules: buildModules(),
  starterKit: {
    prompts: [
      {
        title: "Tạo app web đầu tiên",
        prompt:
          "Tôi không biết lập trình. Hãy tạo cho tôi một app web Next.js mới tên [TÊN APP] bằng create-next-app với cấu hình mặc định, chạy dev server và cho tôi biết địa chỉ mở trong trình duyệt. Giải thích từng bước ngắn gọn.",
      },
      {
        title: "Sửa lỗi cùng agent",
        prompt:
          "Đây là log lỗi tôi gặp khi chạy app: [DÁN LOG LỖI]. Hãy giải thích nguyên nhân bằng tiếng Việt đơn giản, đề xuất cách sửa, rồi sửa giúp tôi và hướng dẫn cách kiểm tra lại.",
      },
      {
        title: "Viết CLAUDE.md cho dự án",
        prompt:
          "Hãy đọc toàn bộ dự án hiện tại và viết file CLAUDE.md mô tả: dự án làm gì, công nghệ dùng, quy ước code, và những điều agent cần lưu ý khi sửa. Viết ngắn gọn, dễ hiểu cho người không chuyên.",
      },
      {
        title: "Đưa app lên internet",
        prompt:
          "Tôi muốn deploy app này lên Vercel. Hãy commit toàn bộ thay đổi, push lên GitHub, rồi hướng dẫn tôi import repo trên Vercel theo từng bước bấm chuột để có link công khai.",
      },
    ],
    tools: [
      {
        name: "Claude Code",
        color: "#D97757",
        desc: "AI coding agent chạy trong terminal — đọc dự án, viết file, chạy lệnh.",
        useFor: "Ra lệnh bằng tiếng Việt để build & sửa app",
      },
      {
        name: "Cursor",
        color: "#000000",
        desc: "Trình soạn thảo có AI tích hợp (giống VS Code).",
        useFor: "Lựa chọn thay thế Claude Code, có giao diện chat",
      },
      {
        name: "Lovable",
        color: "#FF4F88",
        desc: "AI app builder chạy trên trình duyệt, không cần cài đặt.",
        useFor: "Nếm thử vibe coding nhanh, không cần terminal",
      },
      {
        name: "Vercel",
        color: "#000000",
        desc: "Nền tảng deploy app Next.js dễ nhất, nối thẳng GitHub.",
        useFor: "Đưa app lên internet có link công khai",
      },
      {
        name: "Supabase",
        color: "#3ECF8E",
        desc: "Database + Auth thật cho app, có gói miễn phí.",
        useFor: "Thêm dữ liệu thật & đăng nhập cho app",
      },
    ],
  },
  quiz: [
    {
      question:
        "“Vibe coding” nghĩa là gì với một người không biết lập trình?",
      options: [
        "Tự gõ từng dòng code như lập trình viên",
        "Mô tả ý tưởng bằng ngôn ngữ tự nhiên, AI viết code, bạn xem kết quả và yêu cầu chỉnh",
        "Chỉ copy code có sẵn trên mạng về dùng",
        "Thuê người khác làm hộ toàn bộ",
      ],
      correctIndex: 1,
      explanation:
        "Vibe coding (thuật ngữ của Andrej Karpathy): bạn ra lệnh bằng lời, AI agent viết code; việc của bạn là mô tả rõ và nghiệm thu kết quả.",
    },
    {
      question:
        "Khi AI agent báo “đã xong” một tính năng, việc BẮT BUỘC bạn nên làm là gì?",
      options: [
        "Tin tuyệt đối và deploy ngay",
        "Mở app lên xem & test thật xem có chạy đúng không trước khi tin",
        "Xóa luôn dự án cho chắc",
        "Hỏi AI lại 'chắc chưa' rồi thôi",
      ],
      correctIndex: 1,
      explanation:
        "AI có thể sai; “chạy được” khác “đúng và an toàn”. Luôn tự kiểm tra kết quả thật trên trình duyệt, đừng chỉ tin lời agent.",
    },
    {
      question:
        "“commit” và “push” khác nhau thế nào khi làm việc với GitHub?",
      options: [
        "Giống hệt nhau",
        "commit lưu phiên bản trên máy bạn; push mới đẩy phiên bản đó lên GitHub",
        "push lưu trên máy; commit đưa lên mạng",
        "Cả hai đều xóa code cũ",
      ],
      correctIndex: 1,
      explanation:
        "commit chốt một phiên bản kèm ghi chú trên máy; phải push thì code mới lên GitHub để Vercel/Cloudflare deploy được.",
    },
    {
      question:
        "Cách nào giúp AI agent hiểu đúng dự án của bạn và bớt làm sai?",
      options: [
        "Viết prompt thật ngắn kiểu 'làm cho đẹp'",
        "Tạo file CLAUDE.md/.cursorrules mô tả dự án, công nghệ, quy ước cho agent đọc",
        "Không cần làm gì, AI tự hiểu hết",
        "Đổi agent liên tục mỗi lần lỗi",
      ],
      correctIndex: 1,
      explanation:
        "File ngữ cảnh (CLAUDE.md/.cursorrules) dạy agent hiểu dự án — context tốt quan trọng hơn câu chữ prompt hoa mỹ.",
    },
    {
      question:
        "Khi app chạy lỗi sau một lần sửa lớn, bước đầu tiên nên làm là gì?",
      options: [
        "Xóa toàn bộ code và làm lại từ đầu",
        "Đọc log lỗi, xác định file/dòng liên quan, rồi yêu cầu AI sửa đúng lỗi đó",
        "Đổi màu giao diện để xem có hết lỗi không",
        "Deploy lên production để kiểm tra",
      ],
      correctIndex: 1,
      explanation:
        "Log lỗi là bằng chứng quan trọng nhất. Hãy đưa log cụ thể cho AI để sửa có trọng tâm.",
    },
    {
      question:
        "Vì sao nên chạy thử app trên trình duyệt sau khi AI sửa UI?",
      options: [
        "Vì TypeScript luôn bắt được mọi lỗi giao diện",
        "Vì lỗi bố cục, click, responsive và dữ liệu giả chỉ thấy rõ khi dùng thật",
        "Vì chạy trình duyệt làm code nhanh hơn",
        "Vì GitHub yêu cầu bắt buộc",
      ],
      correctIndex: 1,
      explanation:
        "Test bằng mắt và thao tác thật giúp phát hiện các lỗi UI/UX mà lint hoặc typecheck không thấy.",
    },
    {
      question:
        "Khi AI đề xuất cài một package mới, bạn nên phản ứng thế nào?",
      options: [
        "Đồng ý ngay vì package nào cũng tốt",
        "Hỏi vì sao cần, có dùng được thư viện sẵn có không, rồi mới quyết định",
        "Cấm mọi package mới trong mọi trường hợp",
        "Cài thật nhiều package để app chuyên nghiệp hơn",
      ],
      correctIndex: 1,
      explanation:
        "Dependency mới làm tăng chi phí bảo trì. Chỉ thêm khi có lý do rõ và phù hợp dự án.",
    },
    {
      question:
        "File `.env.local` thường dùng để làm gì?",
      options: [
        "Lưu cấu hình bí mật trên máy local như API key và database URL",
        "Lưu ảnh giao diện",
        "Viết nội dung bài học cho người dùng",
        "Thay thế hoàn toàn `package.json`",
      ],
      correctIndex: 0,
      explanation:
        "`.env.local` chứa cấu hình môi trường và thường không được commit lên GitHub vì có thể có secret.",
    },
    {
      question:
        "Nếu AI sửa nhầm quá nhiều file ngoài yêu cầu, cách xử lý tốt là gì?",
      options: [
        "Giữ hết vì càng nhiều thay đổi càng tốt",
        "Soát `git diff`, giữ thay đổi đúng mục tiêu và loại bỏ phần lạc scope",
        "Commit ngay để khỏi mất công xem",
        "Chỉ đổi tên branch",
      ],
      correctIndex: 1,
      explanation:
        "`git diff` giúp kiểm soát phạm vi. Vibe coding vẫn cần người dùng làm người nghiệm thu.",
    },
    {
      question:
        "Khi deploy lên Vercel bị lỗi thiếu biến môi trường, bạn nên làm gì?",
      options: [
        "Dán secret vào code client cho nhanh",
        "Thêm biến môi trường trong Vercel Project Settings rồi redeploy",
        "Tắt toàn bộ tính năng đăng nhập",
        "Đổi tên project",
      ],
      correctIndex: 1,
      explanation:
        "Secret phải nằm trong cấu hình môi trường server/deploy, không hard-code vào frontend.",
    },
  ],
};
