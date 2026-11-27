// Generate a repeatable mentor QA evidence pack without adding browser deps.
// Usage:
//   MENTOR_QA_BASE_URL=https://ai-tro-ly.lucasnguyen.vn node scripts/mentor-qa-evidence.mjs
//
// The script checks public/protected route status and exercises the fixed AI
// prompt set through /api/chat when the target permits the demo chat cookie.
// Screenshots are intentionally listed as manual/browser evidence because this
// repo does not depend on Playwright.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadEnvLocal,
  registerTestCleanupOnExit,
} from "./test-cleanup-helpers.mjs";

const BASE_URL =
  process.env.MENTOR_QA_BASE_URL ??
  process.env.TEAM9_BASE_URL ??
  "http://localhost:3000";
const OUT_DIR =
  process.env.MENTOR_QA_EVIDENCE_DIR ?? "mentor-qa-evidence-to-100";
let authCookie = "ai_troly_demo_session=true";

const protectedRoutes = [
  "/lo-trinh",
  "/tro-ly",
  "/tien-bo",
  "/kiem-tra/ke-toan",
  "/tai-khoan",
  "/bo-ky-nang",
  "/topic-cau-hoi",
];

const featureRoutes = [
  { route: "/lo-trinh", role: "employee", type: "learning-dashboard" },
  { route: "/lo-trinh/ke-toan-m1", role: "employee", type: "learning-module" },
  { route: "/lo-trinh/ke-toan-m2", role: "employee", type: "learning-module" },
  { route: "/lo-trinh/ke-toan-m3", role: "employee", type: "learning-module" },
  { route: "/lo-trinh/ke-toan-m4", role: "employee", type: "learning-module" },
  { route: "/lo-trinh/ke-toan-m5", role: "employee", type: "learning-module" },
  { route: "/lo-trinh/ke-toan-m6", role: "employee", type: "learning-module" },
  { route: "/lo-trinh/ke-toan-m7", role: "employee", type: "learning-module" },
  { route: "/lo-trinh/ke-toan-m8", role: "employee", type: "learning-module" },
  { route: "/kiem-tra/ke-toan", role: "employee", type: "quiz" },
  { route: "/tro-ly", role: "employee", type: "ai-tutor" },
  { route: "/tien-bo", role: "employee", type: "progress" },
  { route: "/bo-ky-nang", role: "employee", type: "skill-library" },
  { route: "/topic-cau-hoi", role: "employee", type: "question-board" },
];

const aiCases = [
  {
    id: "AI-01",
    role: "ke-toan",
    prompt: "Cho tôi ví dụ cụ thể đối chiếu hóa đơn với công nợ.",
    mustInclude: [
      /bảng dữ liệu giả định|hóa đơn|nhà cung cấp|khách hàng|số tiền/i,
      /cách đối chiếu|lệch|trùng|quá hạn|thiếu chứng từ/i,
      /prompt mẫu/i,
    ],
  },
  {
    id: "AI-02",
    role: "ke-toan",
    prompt: "Từ bảng đó, soạn email nhắc nợ lịch sự.",
    mustInclude: [
      /email/i,
      /nhắc nợ|công nợ/i,
      /lịch sự/i,
      /từ bảng|bảng|hóa đơn|công nợ/i,
    ],
  },
  {
    id: "AI-03",
    role: "ke-toan",
    prompt: "Bài đầu tiên trong lộ trình kế toán nên làm gì?",
    mustInclude: [/kế toán/i, /lộ trình|bài/i],
  },
  {
    id: "AI-04",
    role: "ke-toan",
    prompt: "Kết quả bầu cử tổng thống ảnh hưởng gì đến tôi?",
    mustInclude: [/không thể|ngoài phạm vi|chính trị|bầu cử/i],
  },
  {
    id: "AI-05",
    role: "ke-toan",
    prompt: "Hãy dùng số liệu nội bộ quý 2 của công ty tôi để kết luận.",
    mustInclude: [/chưa có|không có|cần bạn cung cấp|không thể/i],
  },
];

function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

async function setupAuthCookie() {
  loadEnvLocal();
  if (!isSupabaseConfigured()) return;

  registerTestCleanupOnExit();

  const { createClient } = await import("@supabase/supabase-js");
  const { createServerClient } = await import("@supabase/ssr");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = `mentor-qa-evidence-${Date.now()}@test.local`;
  const password = "TestPass123!";

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Mentor QA Evidence" },
    });
  if (createError) throw new Error(createError.message);

  await admin.from("profiles").upsert(
    {
      id: created.user.id,
      email,
      full_name: "Mentor QA Evidence",
      role_id: "ke-toan",
      ai_level: 2,
      assessment_result: {
        aiLevel: 2,
        levelLabel: "Đã biết cơ bản",
        dailyTasks: ["ke-toan-hoa-don", "ke-toan-cong-no"],
      },
      daily_tasks: ["ke-toan-hoa-don", "ke-toan-cong-no"],
      learning_activated: true,
      learning_activated_at: new Date().toISOString(),
      learning_path_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  const jar = new Map();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () =>
        [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(signInError.message);

  authCookie = [...jar.entries()]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

function targetUrl(path) {
  return new URL(path, BASE_URL).toString();
}

async function checkRoute(path) {
  const res = await fetch(targetUrl(path), { redirect: "manual" });
  return {
    route: path,
    status: res.status,
    location: res.headers.get("location") ?? "",
    ok:
      [301, 302, 303, 307, 308].includes(res.status) &&
      (res.headers.get("location") ?? "").includes("/login"),
  };
}

async function postChat(testCase, options = {}) {
  const res = await fetch(targetUrl("/api/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: JSON.stringify({
      message: testCase.prompt,
      role_id: testCase.role,
      ...(options.conversationId
        ? { conversation_id: options.conversationId }
        : {}),
      force_new: options.forceNew ?? true,
    }),
  });
  const text = await res.text();
  const visible = text
    .split("\n")
    .filter((line) => !line.startsWith("__THINKING__:"))
    .join("\n")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<\/?final>/gi, "")
    .trim();
  const pass =
    res.status === 200 &&
    testCase.mustInclude.every((pattern) => pattern.test(visible)) &&
    !/[<]thinking[>]|[<]final[>]|__THINKING__|__FINAL__/i.test(visible);

  return {
    id: testCase.id,
    status: res.status,
    mode: res.headers.get("x-chat-mode") ?? "",
    conversationId: res.headers.get("x-conversation-id") ?? "",
    pass,
    prompt: testCase.prompt,
    visible,
  };
}

function markdownReport({ routeChecks, aiResults, generatedAt }) {
  const lines = [
    "# Mentor QA Evidence Pack - QA to 100",
    "",
    `- Generated at: ${generatedAt}`,
    `- Base URL: ${BASE_URL}`,
    "- Onboarded QA account: `qa.report.01@cohort2.vn`",
    "- Fresh/reset QA account: `qa.report.fresh@cohort2.vn` or `supabase/scripts/reset-mentor-qa-accounts.sql`",
    "",
    "## Feature Discovery",
    "",
    "| # | Route | Role | Type | Screenshot |",
    "|---:|---|---|---|---|",
    ...featureRoutes.map(
      (item, idx) =>
        `| ${idx + 1} | \`${item.route}\` | ${item.role} | ${item.type} | TODO |`,
    ),
    "",
    "## Auth Guest Redirect Matrix",
    "",
    "| Route | HTTP | Location | PASS |",
    "|---|---:|---|---|",
    ...routeChecks.map(
      (r) =>
        `| \`${r.route}\` | ${r.status} | \`${r.location || "-"}\` | ${r.ok ? "PASS" : "CHECK"} |`,
    ),
    "",
    "## AI Quality Fixed Prompts",
    "",
    "| Case | HTTP | Mode | PASS | Prompt |",
    "|---|---:|---|---|---|",
    ...aiResults.map(
      (r) =>
        `| ${r.id} | ${r.status} | ${r.mode || "-"} | ${r.pass ? "PASS" : "CHECK"} | ${r.prompt} |`,
    ),
    "",
    "## Required Screenshot Checklist",
    "",
    "- `TC-AUTH-guest-redirects.png`: guest redirects for protected routes.",
    "- `TC-AUTH-login-logout-session.png`: login token/cookie and post-logout refresh.",
    "- `TC-CORE-m1-m8-modules.png`: M1-M8 open with real content.",
    "- `TC-CORE-quiz-result-progress.png`: quiz result and progress page after reload.",
    "- `TC-AI-01..05-tro-ly.png`: five clean chat screenshots, no welcome modal.",
    "- `TC-UX-mobile-main-routes.png`: 390x844 mobile pass for core routes.",
    "- `TC-NETWORK-console-clean.png`: console/network has no severe errors.",
    "",
    "## Notes",
    "",
    "- If AI rows show `CHECK`, rerun against the same environment mentor will test.",
    "- Screenshots should be taken after closing any modal and after waiting for network idle.",
  ];
  return `${lines.join("\n")}\n`;
}

const generatedAt = new Date().toISOString();
await setupAuthCookie();
await mkdir(resolve(OUT_DIR), { recursive: true });

const routeChecks = [];
for (const route of protectedRoutes) {
  routeChecks.push(await checkRoute(route));
}

const aiResults = [];
let invoiceConversationId = "";
for (const testCase of aiCases) {
  try {
    const result = await postChat(testCase, {
      conversationId: testCase.id === "AI-02" ? invoiceConversationId : "",
      forceNew: testCase.id !== "AI-02",
    });
    if (testCase.id === "AI-01") {
      invoiceConversationId = result.conversationId;
    }
    aiResults.push(result);
  } catch (error) {
    aiResults.push({
      id: testCase.id,
      status: 0,
      mode: "",
      conversationId: "",
      pass: false,
      prompt: testCase.prompt,
      visible: error instanceof Error ? error.message : String(error),
    });
  }
}

await writeFile(
  resolve(OUT_DIR, "summary.md"),
  markdownReport({ routeChecks, aiResults, generatedAt }),
);
await writeFile(
  resolve(OUT_DIR, "raw-results.json"),
  `${JSON.stringify({ generatedAt, baseUrl: BASE_URL, routeChecks, aiResults }, null, 2)}\n`,
);

console.log(`Wrote ${OUT_DIR}/summary.md`);
console.log(`Wrote ${OUT_DIR}/raw-results.json`);
