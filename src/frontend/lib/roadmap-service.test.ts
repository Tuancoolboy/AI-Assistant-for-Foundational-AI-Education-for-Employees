// Vitest unit tests cho logic tính % trong roadmap-service.
// Dùng mock client stub để tránh gọi Supabase thật.
// Tập trung: recomputePercent + getProgressSummary — denominator = is_selected=true.

import { describe, expect, it } from "vitest";

// ----- Stub builder cho Supabase query chain -----
// Mô phỏng: supabase.from("...").select("...").eq("...", "...") → { data, error }
type StubResult = { data: unknown; error: null | { message: string } };

function makeQueryStub(result: StubResult) {
  const stub = {
    select: () => stub,
    eq: () => stub,
    then: (resolve: (v: StubResult) => void) => Promise.resolve(resolve(result)),
  };
  // Hỗ trợ await trực tiếp (thenable)
  Object.defineProperty(stub, Symbol.toStringTag, { value: "Promise" });
  return stub;
}

function makeSupabaseStub(
  roadmapData: unknown[],
  progressData: unknown[],
  ownedData: unknown[],
) {
  return {
    from: (table: string) => {
      if (table === "user_skill_groups") {
        return makeQueryStub({ data: ownedData, error: null });
      }
      if (table === "user_roadmap") {
        return makeQueryStub({ data: roadmapData, error: null });
      }
      if (table === "module_progress") {
        return makeQueryStub({ data: progressData, error: null });
      }
      return makeQueryStub({ data: [], error: null });
    },
  };
}

// Hàm nội bộ tính % (trích từ roadmap-service logic)
// Denominator = số bài is_selected=true; tử số = bài đó status='hoan-thanh'
function percentFor(
  rows: { isSelected: boolean; status: string }[],
): number {
  const selected = rows.filter((r) => r.isSelected);
  if (selected.length === 0) return 0;
  const done = selected.filter((r) => r.status === "hoan-thanh").length;
  return Math.round((done / selected.length) * 100);
}

// ----- Tests cho công thức % -----
describe("percentFor — công thức tính % opt-out", () => {
  it("trả về 0 khi không có bài nào được chọn (is_selected=false hết)", () => {
    const rows = [
      { isSelected: false, status: "chua-hoc" },
      { isSelected: false, status: "hoan-thanh" },
    ];
    expect(percentFor(rows)).toBe(0);
  });

  it("trả về 0 khi có bài được chọn nhưng chưa hoàn thành", () => {
    const rows = [
      { isSelected: true, status: "chua-hoc" },
      { isSelected: true, status: "dang-hoc" },
    ];
    expect(percentFor(rows)).toBe(0);
  });

  it("trả về 100 khi tất cả bài được chọn đều hoàn thành", () => {
    const rows = [
      { isSelected: true, status: "hoan-thanh" },
      { isSelected: true, status: "hoan-thanh" },
    ];
    expect(percentFor(rows)).toBe(100);
  });

  it("bài KHÔNG được chọn (is_selected=false) KHÔNG tính vào denominator", () => {
    // 2 bài chọn, 1 hoàn thành → 50%; bài unchecked không ảnh hưởng
    const rows = [
      { isSelected: true, status: "hoan-thanh" },
      { isSelected: true, status: "chua-hoc" },
      { isSelected: false, status: "hoan-thanh" }, // không tính
    ];
    expect(percentFor(rows)).toBe(50);
  });

  it("bài UNCHECKED (opt-out) không kéo % xuống khi các bài còn lại hoàn thành", () => {
    // Học viên opt-out 1 bài → 2/2 selected hoàn thành → 100%
    const rows = [
      { isSelected: true, status: "hoan-thanh" },
      { isSelected: true, status: "hoan-thanh" },
      { isSelected: false, status: "chua-hoc" }, // opt-out
    ];
    expect(percentFor(rows)).toBe(100);
  });

  it("làm tròn về số nguyên", () => {
    // 1/3 ≈ 33.33 → round → 33
    const rows = [
      { isSelected: true, status: "hoan-thanh" },
      { isSelected: true, status: "chua-hoc" },
      { isSelected: true, status: "chua-hoc" },
    ];
    expect(percentFor(rows)).toBe(33);
  });

  it("2/3 hoàn thành → 67%", () => {
    const rows = [
      { isSelected: true, status: "hoan-thanh" },
      { isSelected: true, status: "hoan-thanh" },
      { isSelected: true, status: "chua-hoc" },
    ];
    expect(percentFor(rows)).toBe(67);
  });

  it("mảng rỗng → 0%", () => {
    expect(percentFor([])).toBe(0);
  });
});

// ----- Integration-style test với recomputePercent/getProgressSummary -----
// Import lazily để tránh lỗi nếu module có side-effect cần env
describe("recomputePercent — tích hợp với stub client", () => {
  it("tính đúng % nhóm và tổng từ dữ liệu giả", async () => {
    // Giả lập: user có 1 nhóm 'kinh-doanh', 3 bài
    // bài 1: selected+done, bài 2: selected+chua-hoc, bài 3: not selected
    const roadmapRows = [
      {
        module_id: "m1",
        skill_slug: "kinh-doanh",
        is_selected: true,
        learning_modules: { title: "Bài 1", level: 1, sort_order: 1 },
      },
      {
        module_id: "m2",
        skill_slug: "kinh-doanh",
        is_selected: true,
        learning_modules: { title: "Bài 2", level: 1, sort_order: 2 },
      },
      {
        module_id: "m3",
        skill_slug: "kinh-doanh",
        is_selected: false,
        learning_modules: { title: "Bài 3", level: 2, sort_order: 3 },
      },
    ];
    const progressRows = [{ module_id: "m1", status: "hoan-thanh" }];
    const ownedRows = [
      { skill_slug: "kinh-doanh", skill_groups: { label: "Kinh doanh", sort_order: 1 } },
    ];

    const supabase = makeSupabaseStub(roadmapRows, progressRows, ownedRows);

    // Import động — tránh lỗi nếu module cần env Supabase ở load time
    const { recomputePercent } = await import("./roadmap-service");
    const result = await recomputePercent(supabase as never, "user-123", "kinh-doanh");

    // 2 selected, 1 done → 50%
    expect(result.group).toBe(50);
    expect(result.total).toBe(50);
  });

  it("getProgressSummary trả về 0 khi không có bài nào selected", async () => {
    const roadmapRows = [
      {
        module_id: "m1",
        skill_slug: "marketing",
        is_selected: false,
        learning_modules: { title: "Bài 1", level: 1, sort_order: 1 },
      },
    ];
    const ownedRows = [
      { skill_slug: "marketing", skill_groups: { label: "Marketing", sort_order: 2 } },
    ];

    const supabase = makeSupabaseStub(roadmapRows, [], ownedRows);
    const { getProgressSummary } = await import("./roadmap-service");
    const summary = await getProgressSummary(supabase as never, "user-456");

    expect(summary.totalSelected).toBe(0);
    expect(summary.totalCompleted).toBe(0);
    expect(summary.percent).toBe(0);
  });

  it("getProgressSummary trả đúng breakdown hoàn thành / đang học / chưa học (QA A-05)", async () => {
    const roadmapRows = [
      {
        module_id: "m1",
        skill_slug: "ke-toan",
        is_selected: true,
        learning_modules: { title: "Bài 1", level: 1, sort_order: 1 },
      },
      {
        module_id: "m2",
        skill_slug: "ke-toan",
        is_selected: true,
        learning_modules: { title: "Bài 2", level: 1, sort_order: 2 },
      },
      {
        module_id: "m3",
        skill_slug: "ke-toan",
        is_selected: true,
        learning_modules: { title: "Bài 3", level: 1, sort_order: 3 },
      },
      {
        module_id: "m4",
        skill_slug: "ke-toan",
        is_selected: false,
        learning_modules: { title: "Bài 4 (không chọn)", level: 1, sort_order: 4 },
      },
    ];
    const progressRows = [
      { module_id: "m1", status: "hoan-thanh" },
      { module_id: "m2", status: "dang-hoc" },
      // m3: không có row progress → mặc định chưa học
    ];
    const ownedRows = [
      { skill_slug: "ke-toan", skill_groups: { label: "Kế toán", sort_order: 1 } },
    ];

    const supabase = makeSupabaseStub(roadmapRows, progressRows, ownedRows);
    const { getProgressSummary } = await import("./roadmap-service");
    const summary = await getProgressSummary(supabase as never, "user-789");

    expect(summary.totalSelected).toBe(3);
    expect(summary.totalCompleted).toBe(1);
    expect(summary.totalLearning).toBe(1);
    expect(summary.totalNotStarted).toBe(1);
  });
});
