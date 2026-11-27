"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {

  fetchQuizSummary,
  trackEvent,
  isSupabaseBackend,
  type QuizResultItem,
  type TimeLogItem,
} from "@/lib/client-api";
import {
  addDemoTimeLog,
  getDemoProfile,
  getDemoProgress,
  getDemoQuizResults,
  getDemoTimeLogs,
  type DemoProgress,
  type DemoQuizResult,
  type DemoTimeLog,
} from "@/lib/demo-storage";

import { getModulesForUser, getRole } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { TienBoPageSkeleton } from "@/components/skeletons/page-skeletons";
import {
  addEmployeeTimeLog,
  getEmployeeProfile,
  getEmployeeProgress,
  getEmployeeTimeLogs,
} from "@/lib/supabase/employee";

import { exportLearningReport } from "@/lib/excel-export";

// Recharts imports for premium visualization
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const QUICK_HOURS = [0.5, 1, 2, 4];

function StableChartFrame({
  className,
  children,
  fallback,
}: {
  className: string;
  children: ReactNode;
  fallback: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateSize = () => {
      const rect = frame.getBoundingClientRect();
      setHasSize(rect.width > 0 && rect.height > 0);
    };

    const frameId = requestAnimationFrame(updateSize);
    if (typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={frameRef} className={className}>
      {hasSize ? children : fallback}
    </div>
  );
}

function ChartStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-center text-xs text-ink-3">
      {children}
    </div>
  );
}

export function TienBoContent() {
  const [profile, setProfile] = useState<ReturnType<typeof getDemoProfile>>(null);
  const [logs, setLogs] = useState<(DemoTimeLog | TimeLogItem)[]>([]);
  const [quizResults, setQuizResults] = useState<(DemoQuizResult | QuizResultItem)[]>([]);
  const [avgScore, setAvgScore] = useState(0);
  const [bestQuizScore, setBestQuizScore] = useState(0);
  const [percentComplete, setPercentComplete] = useState(0);
  const [progressBreakdown, setProgressBreakdown] = useState({
    done: 0,
    learning: 0,
    notStarted: 0,
  });
  const [usefulness, setUsefulness] = useState(8);
  const [hydrated, setHydrated] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [logging, setLogging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Filters & Sorting states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterMetric, setFilterMetric] = useState<"all" | "hours" | "quizzes" | "progress">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // State to check if mounted (prevents hydration warning on Recharts)
  const [mounted, setMounted] = useState(false);

  async function refresh() {
    setErrorMessage("");
    try {
      const supabaseReady = isSupabaseConfigured();

      let p: ReturnType<typeof getDemoProfile>;
      let nextLogs: (DemoTimeLog | TimeLogItem)[];
      let progress: DemoProgress;
      let nextQuizResults: (DemoQuizResult | QuizResultItem)[] = [];
      let nextAvgScore = 0;
      let nextBestScore = 0;

      if (supabaseReady) {
        const [prof, logsData, quiz, prog] = await Promise.all([
          getEmployeeProfile(),
          getEmployeeTimeLogs(),
          fetchQuizSummary().catch(() => null),
          getEmployeeProgress(),
        ]);
        p = prof;
        nextLogs = logsData;
        progress = prog;
        nextQuizResults = quiz?.results ?? [];
        nextAvgScore = quiz?.averageScore ?? 0;
        nextBestScore = quiz?.bestScore ?? 0;
      } else {
        p = getDemoProfile();
        nextLogs = getDemoTimeLogs();
        progress = getDemoProgress();
        nextQuizResults = getDemoQuizResults();
        nextAvgScore =
          nextQuizResults.length === 0
            ? 0
            : Math.round(
                nextQuizResults.reduce((sum, r) => sum + r.score, 0) /
                  nextQuizResults.length,
              );
        nextBestScore =
          nextQuizResults.length > 0
            ? Math.max(...nextQuizResults.map((r) => r.score))
            : 0;
      }

      setProfile(p);
      setLogs(nextLogs);
      setQuizResults(nextQuizResults);
      setAvgScore(nextAvgScore);
      setBestQuizScore(nextBestScore);

      // Tính breakdown (hoàn thành/đang học/chưa học) từ modules + progress local
      // — dùng làm fallback khi progress-summary lỗi, và cho demo mode (không
      // gọi API). QA finding A-05: user hay nhầm % vì không thấy breakdown.
      function localBreakdown(profileForCalc: typeof p) {
        if (!profileForCalc) return { done: 0, learning: 0, notStarted: 0 };
        const aiLevel = profileForCalc.assessment?.aiLevel ?? 0;
        const modules = getModulesForUser(profileForCalc.roleId, aiLevel);
        const done = modules.filter((m) => progress[m.id] === "hoan-thanh").length;
        const learning = modules.filter((m) => progress[m.id] === "dang-hoc").length;
        return { done, learning, notStarted: modules.length - done - learning };
      }

      // Đọc % hoàn thành từ progress-summary (opt-out model: mẫu số = is_selected=true).
      if (supabaseReady) {
        try {
          const summaryRes = await fetch("/api/member/progress-summary");
          if (summaryRes.ok) {
            const summary = (await summaryRes.json()) as {
              ok?: boolean;
              percent?: number;
              totalCompleted?: number;
              totalLearning?: number;
              totalNotStarted?: number;
            };
            if (summary.ok && typeof summary.percent === "number") {
              setPercentComplete(summary.percent);
              setProgressBreakdown({
                done: summary.totalCompleted ?? 0,
                learning: summary.totalLearning ?? 0,
                notStarted: summary.totalNotStarted ?? 0,
              });
            }
          }
        } catch {
          // fallback: tính local nếu summary fail
          if (p) {
            const aiLevel = p.assessment?.aiLevel ?? 0;
            const modules = getModulesForUser(p.roleId, aiLevel);
            const completed = modules.filter(
              (m) => progress[m.id] === "hoan-thanh",
            ).length;
            setPercentComplete(
              modules.length > 0
                ? Math.round((completed / modules.length) * 100)
                : 0,
            );
          } else {
            setPercentComplete(0);
          }
          setProgressBreakdown(localBreakdown(p));
        }
      } else if (p) {
        const aiLevel = p.assessment?.aiLevel ?? 0;
        const modules = getModulesForUser(p.roleId, aiLevel);
        const completed = modules.filter(
          (m) => progress[m.id] === "hoan-thanh",
        ).length;
        setPercentComplete(
          modules.length > 0
            ? Math.round((completed / modules.length) * 100)
            : 0,
        );
        setProgressBreakdown(localBreakdown(p));
      } else {
        setPercentComplete(0);
        setProgressBreakdown({ done: 0, learning: 0, notStarted: 0 });
      }
    } catch (err) {
      console.warn("[tien-bo] Không đọc được dữ liệu Supabase:", err);
      setErrorMessage("Chưa đọc được dữ liệu học tập. Vui lòng tải lại trang.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await refresh();
      if (!cancelled) {
        setHydrated(true);
        setMounted(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter logs and quiz results locally based on user selection
  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter((l) => new Date(l.loggedAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((l) => new Date(l.loggedAt) <= end);
    }
    result.sort((a, b) => {
      const timeA = new Date(a.loggedAt).getTime();
      const timeB = new Date(b.loggedAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [logs, startDate, endDate, sortOrder]);

  const filteredQuizResults = useMemo(() => {
    let result = [...quizResults];
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter((q) => new Date(q.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((q) => new Date(q.createdAt) <= end);
    }
    result.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [quizResults, startDate, endDate, sortOrder]);

  // Recalculate KPIs based on filtered values
  const totalFilteredHours = useMemo(() => {
    return filteredLogs.reduce((sum, log) => sum + log.hoursSaved, 0);
  }, [filteredLogs]);

  const averageFilteredScore = useMemo(() => {
    if (filteredQuizResults.length === 0) return 0;
    return Math.round(
      filteredQuizResults.reduce((sum, r) => sum + r.score, 0) /
        filteredQuizResults.length,
    );
  }, [filteredQuizResults]);

  // Aggregate hourly savings by date for AreaChart
  const timeLogChartData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    // Collect last 10 dates with logs or within current filter range
    filteredLogs.forEach((log) => {
      const dateKey = new Date(log.loggedAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      });
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + log.hoursSaved;
    });

    return Object.keys(dailyMap)
      .map((date) => ({ date, "Số giờ": dailyMap[date] }))
      .reverse(); // chronologic
  }, [filteredLogs]);

  // Quiz history chart data
  const quizChartData = useMemo(() => {
    return filteredQuizResults
      .slice(0, 8)
      .map((q, idx) => ({
        name: `Lần ${filteredQuizResults.length - idx}`,
        "Điểm": q.score,
      }))
      .reverse();
  }, [filteredQuizResults]);

  // Donut chart representation for course progress
  const progressDonutData = useMemo(() => {
    return [
      { name: "Hoàn thành", value: percentComplete },
      { name: "Còn lại", value: 100 - percentComplete },
    ];
  }, [percentComplete]);

  const handleExportExcel = () => {
    if (!profile) return;
    exportLearningReport({
      profile: {
        fullName: profile.fullName ?? null,
        roleId: profile.roleId ?? null,
        aiLevel: profile.assessment?.aiLevel ?? 0,
        levelLabel: profile.assessment?.levelLabel ?? null,
      },
      logs: filteredLogs,
      quizResults: filteredQuizResults,
      totalHours: totalFilteredHours,
      avgScore: averageFilteredScore,
      percentComplete,
      dateFilter: startDate || endDate ? { start: startDate || new Date(0).toISOString(), end: endDate || new Date().toISOString() } : undefined,
    });
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setFilterMetric("all");
    setSortOrder("desc");
  };

  if (!hydrated) {
    return <TienBoPageSkeleton />;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">
          Hoàn thành onboarding trước
        </h1>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-brand px-7 text-base font-semibold text-brand-foreground transition hover:bg-brand-2"
        >
          Vào onboarding →
        </Link>
      </div>
    );
  }

  const role = getRole(profile.roleId);

  async function logHours(hours: number) {
    if (logging) return;
    setLogging(true);
    setErrorMessage("");
    try {
      if (isSupabaseConfigured()) {
        await addEmployeeTimeLog(hours, usefulness);
        if (isSupabaseBackend()) {
          void trackEvent("journal_logged", { hoursSaved: hours, usefulness });
        }
      } else {
        addDemoTimeLog(hours, usefulness);
      }
      setJustLogged(true);
      await refresh();
      setTimeout(() => setJustLogged(false), 2000);
    } catch (err) {
      console.warn("[tien-bo] Không lưu được nhật ký Supabase:", err);
      setErrorMessage("Chưa lưu được nhật ký. Vui lòng thử lại.");
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
            Tiến bộ cá nhân · {role?.shortLabel}
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Báo cáo tiến độ học tập
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            Theo dõi, đánh giá hiệu quả tiếp thu kiến thức và thời lượng làm việc được tối ưu hóa bằng trợ lý AI.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-5 text-sm font-semibold transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          aria-label="Tải báo cáo Excel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Xuất báo cáo Excel
        </button>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive animate-fade-in" role="alert" aria-live="polite">
          {errorMessage}
        </div>
      )}

      {/* FILTER BAR - REDESIGNED UX */}
      <div className="mb-8 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3 mb-4">Bộ lọc & sắp xếp dữ liệu</h3>
        
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end">
          {/* Start Date */}
          <div>
            <label htmlFor="start-date" className="block text-xs font-semibold text-ink-2 mb-1.5">Từ ngày</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-line bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="end-date" className="block text-xs font-semibold text-ink-2 mb-1.5">Đến ngày</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-line bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Filter Metric */}
          <div>
            <label htmlFor="metric-filter" className="block text-xs font-semibold text-ink-2 mb-1.5">Loại chỉ số hiển thị</label>
            <select
              id="metric-filter"
              value={filterMetric}
              onChange={(e) => setFilterMetric(e.target.value as "all" | "hours" | "quizzes" | "progress")}
              className="w-full h-10 px-3 rounded-lg border border-line bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            >
              <option value="all">Tất cả chỉ số</option>
              <option value="hours">Thời gian tiết kiệm</option>
              <option value="quizzes">Kết quả kiểm tra</option>
              <option value="progress">Tiến trình lộ trình</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label htmlFor="sort-order" className="block text-xs font-semibold text-ink-2 mb-1.5">Sắp xếp theo ngày</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              className="w-full h-10 px-3 rounded-lg border border-line bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            >
              <option value="desc">Mới nhất trước</option>
              <option value="asc">Cũ nhất trước</option>
            </select>
          </div>
        </div>

        {/* Filter Badges & Clear Button */}
        {(startDate || endDate || filterMetric !== "all" || sortOrder !== "desc") && (
          <div className="mt-4 pt-4 border-t border-line-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {startDate && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">
                  Từ: {startDate}
                </span>
              )}
              {endDate && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">
                  Đến: {endDate}
                </span>
              )}
              {filterMetric !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">
                  Chỉ số: {filterMetric === "hours" ? "Thời gian" : filterMetric === "quizzes" ? "Kiểm tra" : "Tiến trình"}
                </span>
              )}
            </div>
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Metric 1: Total hours saved */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:shadow-md">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl" />
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Giờ tiết kiệm</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-extrabold text-ink font-variant-numeric: tabular-nums">
              {totalFilteredHours.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-ink-3">giờ</span>
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {filteredLogs.length === 0
              ? "Chưa ghi nhận logs"
              : `Từ ${filteredLogs.length} lần lưu nhật ký`}
          </p>
        </div>

        {/* Metric 2: Course completion */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:shadow-md">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl" />
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Hoàn thành lộ trình</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-extrabold text-ink font-variant-numeric: tabular-nums">
              {percentComplete}%
            </span>
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {progressBreakdown.done} hoàn thành · {progressBreakdown.learning} đang học ·{" "}
            {progressBreakdown.notStarted} chưa học
          </p>
        </div>

        {/* Metric 3: Quiz average score */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:shadow-md">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl" />
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Điểm MCQ trung bình</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-extrabold text-ink font-variant-numeric: tabular-nums">
              {filteredQuizResults.length > 0 ? averageFilteredScore : "—"}
            </span>
            {filteredQuizResults.length > 0 && <span className="text-sm font-medium text-ink-3">/100</span>}
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {filteredQuizResults.length > 0
              ? `Điểm cao nhất: ${bestQuizScore}`
              : "Chưa tham gia kiểm tra"}
          </p>
        </div>

        {/* Metric 4: AI Level */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:shadow-md">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl" />
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Trình độ trợ lý AI</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-extrabold text-ink font-variant-numeric: tabular-nums">
              {profile.assessment?.aiLevel ?? 0}
            </span>
            <span className="text-sm font-medium text-ink-3">/5</span>
          </div>
          <p className="mt-2 text-xs text-ink-3 truncate">
            {profile.assessment?.levelLabel || "Chưa có đánh giá"}
          </p>
        </div>
      </div>

      {/* CHARTS CONTAINER - VISUAL EXCELLENCE */}
      {mounted && (
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {/* Chart 1: Time savings trend */}
          {(filterMetric === "all" || filterMetric === "hours") && (
            <div className="md:col-span-2 rounded-2xl border border-line bg-card p-5 shadow-sm">
              <h3 className="font-display text-base font-bold text-ink mb-1">
                Xu hướng tiết kiệm thời gian (giờ)
              </h3>
              <p className="text-xs text-ink-3 mb-4">Tổng số giờ làm việc được tối ưu hóa qua từng ngày</p>
              
              <StableChartFrame
                className="h-64 w-full min-w-0"
                fallback={<ChartStatus>Đang chuẩn bị biểu đồ...</ChartStatus>}
              >
                {timeLogChartData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    initialDimension={{ width: 1, height: 1 }}
                  >
                    <AreaChart data={timeLogChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="date" tickLine={false} style={{ fontSize: 11, fill: "#6b7280" }} />
                      <YAxis tickLine={false} style={{ fontSize: 11, fill: "#6b7280" }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e5e7eb" }}
                        labelStyle={{ fontWeight: "bold", color: "#111827" }}
                      />
                      <Area type="monotone" dataKey="Số giờ" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHours)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartStatus>
                    Không có dữ liệu thời gian cho khoảng ngày này
                  </ChartStatus>
                )}
              </StableChartFrame>
            </div>
          )}

          {/* Chart 2: Course Progress Ring */}
          {(filterMetric === "all" || filterMetric === "progress") && (
            <div className="rounded-2xl border border-line bg-card p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-ink mb-1">
                  Tiến trình hoàn thành
                </h3>
                <p className="text-xs text-ink-3 mb-4">% các bài học và lộ trình đã hoàn thành</p>
              </div>

              <div className="relative h-44 w-full">
                <StableChartFrame
                  className="absolute inset-0 min-w-0"
                  fallback={<div className="h-full w-full" aria-hidden="true" />}
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    initialDimension={{ width: 1, height: 1 }}
                  >
                    <PieChart>
                      <Pie
                        data={progressDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={75}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f3f4f6" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </StableChartFrame>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-extrabold text-ink font-variant-numeric: tabular-nums">
                    {percentComplete}%
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">Đã đạt</span>
                </div>
              </div>

              <div className="text-center text-xs text-ink-2 font-medium mt-2">
                {progressBreakdown.done} hoàn thành · {progressBreakdown.learning} đang học ·{" "}
                {progressBreakdown.notStarted} chưa học
              </div>
            </div>
          )}

          {/* Chart 3: Quiz Score History */}
          {(filterMetric === "all" || filterMetric === "quizzes") && (
            <div className="md:col-span-3 rounded-2xl border border-line bg-card p-5 shadow-sm">
              <h3 className="font-display text-base font-bold text-ink mb-1">
                Lịch sử điểm thi trắc nghiệm MCQ
              </h3>
              <p className="text-xs text-ink-3 mb-4">Điểm số đạt được qua từng lần kiểm tra (thang điểm 100)</p>

              <StableChartFrame
                className="h-56 w-full min-w-0"
                fallback={<ChartStatus>Đang chuẩn bị biểu đồ...</ChartStatus>}
              >
                {quizChartData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    initialDimension={{ width: 1, height: 1 }}
                  >
                    <BarChart data={quizChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" tickLine={false} style={{ fontSize: 11, fill: "#6b7280" }} />
                      <YAxis tickLine={false} domain={[0, 100]} style={{ fontSize: 11, fill: "#6b7280" }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e5e7eb" }}
                      />
                      <Bar dataKey="Điểm" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={45}>
                        {quizChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry["Điểm"] >= 80 ? "#10b981" : entry["Điểm"] >= 50 ? "#0d9488" : "#f43f5e"} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartStatus>
                    Không có lịch sử điểm kiểm tra trong khoảng ngày này
                  </ChartStatus>
                )}
              </StableChartFrame>
            </div>
          )}
        </div>
      )}

      {/* QUICK TIME LOGGING SECTION */}
      <div className="mb-8 rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-xl font-bold text-ink">
          Ghi nhận thời gian tiết kiệm hôm nay
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Chọn số lượng giờ bạn đã tiết kiệm được bằng cách sử dụng các mẹo và giải pháp AI trợ lý.
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {QUICK_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => logHours(h)}
              disabled={logging}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-emerald-600 bg-card px-5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              +{h} giờ
            </button>
          ))}
        </div>

        <div className="mt-5">
          <span className="block text-xs font-bold uppercase tracking-wider text-ink-3">
            Mức độ hữu ích: {usefulness}/10
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={usefulness}
            onChange={(e) => setUsefulness(Number(e.target.value))}
            className="mt-2 w-full accent-emerald-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {justLogged && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-700 animate-fade-in" role="status" aria-live="polite">
            ✓ Đã lưu thành công nhật ký tiết kiệm giờ. Bảng chỉ số đã tự động cập nhật!
          </div>
        )}
      </div>

      {/* DETAILED TABLES GRID */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Table 1: Quiz History */}
        <div className="rounded-3xl border border-line bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-display text-lg font-bold text-ink">
              Lịch sử bài kiểm MCQ
            </h2>
            <Link
              href={`/kiem-tra/${profile.roleId}`}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Làm bài mới →
            </Link>
          </div>

          {filteredQuizResults.length > 0 ? (
            <ul className="divide-y divide-line-2 max-h-80 overflow-y-auto pr-1">
              {filteredQuizResults.map((result) => {
                const resultRole = getRole(result.roleId);
                return (
                  <li
                    key={result.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`inline-flex items-center justify-center w-14 py-1 rounded-full text-xs font-bold font-variant-numeric: tabular-nums ${
                          result.passed
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                        }`}
                      >
                        {result.score}/100
                      </span>
                      <span className="font-medium text-ink truncate max-w-[120px] sm:max-w-none">
                        {resultRole?.shortLabel ?? result.roleId}
                      </span>
                    </div>
                    <span className="text-xs text-ink-3 whitespace-nowrap">
                      {formatVietnameseDate(result.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-8 text-center text-xs text-ink-3">
              Không tìm thấy kết quả kiểm tra nào.
            </div>
          )}
        </div>

        {/* Table 2: Recent Logs */}
        <div className="rounded-3xl border border-line bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink mb-4">
            Nhật ký hoạt động
          </h2>

          {filteredLogs.length > 0 ? (
            <ul className="divide-y divide-line-2 max-h-80 overflow-y-auto pr-1">
              {filteredLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950 font-variant-numeric: tabular-nums">
                      +{log.hoursSaved}h
                    </span>
                    <span className="text-ink-2">
                      {formatVietnameseDate(log.loggedAt)}
                    </span>
                  </div>
                  {log.usefulness !== undefined && (
                    <span className="text-xs text-ink-3">
                      Hữu ích {log.usefulness}/10
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-xs text-ink-3">
              Không tìm thấy nhật ký hoạt động nào.
            </div>
          )}
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
        <Link
          href="/lo-trinh"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-card hover:bg-muted text-ink-2 px-6 text-sm font-semibold transition"
        >
          ← Tiếp tục học lộ trình
        </Link>
        <Link
          href={`/kiem-tra/${profile.roleId}`}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-6 text-sm font-semibold transition shadow-sm"
        >
          Làm bài kiểm tra đánh giá →
        </Link>
      </div>
    </div>
  );
}

function formatVietnameseDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diffMs = today.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return "Vừa xong";
  if (diffHours < 24) return `${Math.floor(diffHours)} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
