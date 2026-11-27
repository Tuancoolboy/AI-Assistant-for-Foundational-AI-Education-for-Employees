"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Download, Calendar, RefreshCw } from "lucide-react";
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
  Legend,
} from "recharts";
import * as XLSX from "xlsx";

import {
  ClearFiltersButton,
  ListSearchField,
  ListSelectField,
  PaginationBar,
  StatusBadge,
} from "@/components/platform-admin/platform-admin-list-primitives";
import {
  PanelCard,
  Th,
  Td,
  formatNumber,
  formatDate,
} from "@/components/platform-admin/platform-admin-console-ui";
import { paginateItems } from "@/components/platform-admin/platform-admin-list-utils";

type MetricRow = {
  userId: string;
  name: string;
  email: string;
  roleId: string | null;
  activated: boolean;
  completedCount: number;
  selectedCount: number;
  percent: number;
  quizCount: number;
  quizAvg: number;
  quizPassed: number;
  chatCount: number;
  hoursSaved: number;
  points: number;
  activeDays: number;
  sessionCount: number;
  avgSessionMin: number;
  lastSignIn: string | null;
  lastActivityAt: string | null;
};

type Summary = {
  totalUsers: number;
  activatedCount: number;
  learningCount: number;
  avgPercent: number;
  totalCompleted: number;
  avgQuiz: number;
  totalChat: number;
  totalHours: number;
  totalPoints: number;
};

type CompletedByDateItem = {
  date: string;
  completedCount: number;
  activeLearners: number;
  hoursSaved: number;
  activityCount: number;
};

type DailyDetailItem = {
  date: string;
  userId: string;
  name: string;
  email: string;
  roleId: string | null;
  completedCount: number;
  hoursSaved: number;
  chatCount: number;
  quizCount: number;
  quizAvg: number;
};

type ExportCell = string | number | boolean | null;
type ExportRow = ExportCell[];

export function LearningMetricsTab() {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [completedByDate, setCompletedByDate] = useState<CompletedByDateItem[]>([]);
  const [dailyDetails, setDailyDetails] = useState<DailyDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activationFilter, setActivationFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [datePreset, setDatePreset] = useState("7d");
  
  // Tính toán default date cho 7 ngày qua
  const [fromDate, setFromDate] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return start.toLocaleDateString("en-CA");
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toLocaleDateString("en-CA");
  });

  const [isMounted, setIsMounted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSelectPreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    if (preset === "all") {
      setFromDate("");
      setToDate("");
    } else if (preset === "today") {
      const todayStr = today.toLocaleDateString("en-CA");
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === "7d") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      setFromDate(start.toLocaleDateString("en-CA"));
      setToDate(today.toLocaleDateString("en-CA"));
    } else if (preset === "30d") {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setFromDate(start.toLocaleDateString("en-CA"));
      setToDate(today.toLocaleDateString("en-CA"));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        
        const res = await fetch(`/api/platform-admin/learning-metrics?${params}`);
        const data = (await res.json()) as {
          ok?: boolean;
          rows?: MetricRow[];
          summary?: Summary;
          completedByDate?: CompletedByDateItem[];
          dailyDetails?: DailyDetailItem[];
          error?: { message?: string };
        };
        
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error?.message ?? "Không tải được dữ liệu đo lường.");
        } else {
          setRows(data.rows ?? []);
          setSummary(data.summary ?? null);
          setCompletedByDate(data.completedByDate ?? []);
          setDailyDetails(data.dailyDetails ?? []);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Lỗi mạng khi tải dữ liệu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate, refreshTrigger]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        [row.name, row.email, row.roleId ?? ""].some((value) =>
          String(value).toLowerCase().includes(normalizedQuery),
        );
      const matchesRole = roleFilter === "all" || row.roleId === roleFilter;
      const matchesActivation =
        activationFilter === "all" ||
        (activationFilter === "activated" ? row.activated : !row.activated);
      const matchesProgress =
        progressFilter === "all" ||
        (progressFilter === "none"
          ? row.percent === 0
          : progressFilter === "learning"
            ? row.completedCount > 0 && row.percent < 100
            : progressFilter === "completed"
              ? row.percent >= 100
              : row.percent >= 70);
      return matchesQuery && matchesRole && matchesActivation && matchesProgress;
    });
  }, [rows, query, roleFilter, activationFilter, progressFilter]);

  const paginatedRows = useMemo(
    () => paginateItems(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  );

  const handleExportExcel = () => {
    if (!summary) return;
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // --- Sheet 1: Tong_Quan ---
      const overviewData: ExportRow[] = [
        ["BÁO CÁO ĐO LƯỜNG HỌC TẬP TOÀN HỆ THỐNG"],
        [],
        ["Khoảng thời gian báo cáo:", fromDate || toDate ? `${formatCalendarDate(fromDate || "Bắt đầu")} - ${formatCalendarDate(toDate || "Hiện tại")}` : "Tất cả thời gian"],
        ["Thời gian xuất báo cáo:", new Date().toLocaleString("vi-VN")],
        [],
        ["CHỈ SỐ TỔNG HỢP TOÀN HỆ THỐNG (KPIs)"],
        ["Chỉ số", "Giá trị", "Đơn vị"],
        ["Tổng số học viên", summary.totalUsers, "học viên"],
        ["Học viên đã kích hoạt", summary.activatedCount, "học viên"],
        ["Tỷ lệ kích hoạt", summary.totalUsers > 0 ? `${Math.round((summary.activatedCount / summary.totalUsers) * 100)}%` : "0%", ""],
        ["Đang học (≥ 1 bài)", summary.learningCount, "học viên"],
        ["Tỷ lệ hoàn thành trung bình", `${summary.avgPercent}%`, ""],
        ["Tổng số bài đã hoàn thành", summary.totalCompleted, "bài"],
        ["Tổng lượt chat AI", summary.totalChat, "lượt"],
        ["Tổng số giờ tiết kiệm nhờ AI", summary.totalHours, "giờ"],
        ["Điểm kiểm tra trung bình", summary.avgQuiz > 0 ? summary.avgQuiz : "N/A", "điểm"],
        ["Tổng điểm tích lũy", summary.totalPoints, "điểm"]
      ];
      const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
      wsOverview["!cols"] = [{ wch: 35 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsOverview, "Tong_Quan");

      // --- Sheet 2: Danh_Sach_Hoc_Vien ---
      const listHeaders = [
        "Học viên", "Email", "Vai trò", "Kích hoạt", "Bài hoàn thành", "Tổng số bài", 
        "Tiến độ (%)", "Số bài quiz", "Điểm trung bình", "Số bài quiz đạt", 
        "Lượt chat AI", "Giờ tiết kiệm", "Điểm tích lũy", "Số ngày hoạt động", 
        "Số phiên", "Thời gian phiên TB (phút)", "Truy cập gần nhất"
      ];
      const listData: ExportRow[] = [listHeaders];
      filteredRows.forEach((r) => {
        listData.push([
          r.name,
          r.email,
          r.roleId ?? "—",
          r.activated ? "Đã kích hoạt" : "Chưa kích hoạt",
          r.completedCount,
          r.selectedCount,
          r.percent,
          r.quizCount,
          r.quizAvg,
          r.quizPassed,
          r.chatCount,
          r.hoursSaved,
          r.points,
          r.activeDays,
          r.sessionCount,
          r.avgSessionMin,
          r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleString("vi-VN") : (r.lastSignIn ? new Date(r.lastSignIn).toLocaleString("vi-VN") : "—")
        ]);
      });
      const wsList = XLSX.utils.aoa_to_sheet(listData);
      wsList["!cols"] = [
        { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 22 }, { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(wb, wsList, "Danh_Sach_Hoc_Vien");

      // --- Daily Sheets (Nếu có filter ngày) ---
      const hasDateFilter = Boolean(fromDate || toDate);
      if (hasDateFilter && dailyDetails.length > 0) {
        // Gom chi tiết theo ngày
        const dailyGroups: Record<string, DailyDetailItem[]> = {};
        dailyDetails.forEach((detail) => {
          if (!dailyGroups[detail.date]) {
            dailyGroups[detail.date] = [];
          }
          dailyGroups[detail.date].push(detail);
        });

        // Tạo sheet cho mỗi ngày có hoạt động
        Object.keys(dailyGroups).sort().forEach((dateStr) => {
          const dayDetails = dailyGroups[dateStr];
          const sheetHeaders = ["Học viên", "Email", "Vai trò", "Bài hoàn thành", "Giờ tiết kiệm", "Lượt chat AI", "Bài quiz làm", "Điểm quiz trung bình"];
          const sheetData: ExportRow[] = [
            [`CHI TIẾT HOẠT ĐỘNG NGÀY ${formatCalendarDate(dateStr)}`],
            [],
            sheetHeaders
          ];
          dayDetails.forEach((d) => {
            sheetData.push([
              d.name,
              d.email,
              d.roleId ?? "—",
              d.completedCount,
              d.hoursSaved,
              d.chatCount,
              d.quizCount,
              d.quizAvg
            ]);
          });
          const wsDay = XLSX.utils.aoa_to_sheet(sheetData);
          wsDay["!cols"] = [
            { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }
          ];
          
          // Sheet name format: D_DD_MM
          const parts = dateStr.split("-");
          const sheetName = `D_${parts[2]}_${parts[1]}`;
          XLSX.utils.book_append_sheet(wb, wsDay, sheetName);
        });
      }

      const dateSuffix = fromDate || toDate ? `${fromDate || "start"}_to_${toDate || "now"}` : "all_time";
      const fileName = `bao_cao_do_luong_hoc_tap_${dateSuffix}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Lỗi xuất Excel:", err);
    } finally {
      setExporting(false);
    }
  };

  if (loading && rows.length === 0) {
    return <div className="mt-6 h-40 animate-pulse rounded-xl bg-secondary" />;
  }

  if (error && rows.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-5">
      {/* 1. KHỐI KPI TỔNG HỢP */}
      {summary ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Học viên" value={formatNumber(summary.totalUsers)} />
          <Metric
            label="Đã kích hoạt"
            value={`${formatNumber(summary.activatedCount)}/${formatNumber(summary.totalUsers)}`}
          />
          <Metric label="Đang học" value={formatNumber(summary.learningCount)} />
          <Metric label="TB hoàn thành" value={`${summary.avgPercent}%`} />
          <Metric label="Tổng lượt chat" value={formatNumber(summary.totalChat)} />
          <Metric label="Giờ tiết kiệm" value={`${summary.totalHours}h`} />
        </div>
      ) : null}

      {/* 2. BIỂU ĐỒ HOẠT ĐỘNG (Render phía client-side) */}
      {isMounted && completedByDate.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Biểu đồ số lượng hoạt động học tập */}
          <PanelCard className="p-4 h-[350px]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Số hoạt động học tập theo ngày</h3>
              <span className="text-xs text-ink-3">Tương tác bài học, quiz, chat AI & nhật ký</span>
            </div>
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={completedByDate}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorActivities" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatCalendarDate} 
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip 
                    labelFormatter={(label) => `Ngày ${formatCalendarDate(label)}`}
                    formatter={(value) => [`${value} hoạt động`, "Hoạt động"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="activityCount" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorActivities)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PanelCard>

          {/* Biểu đồ số bài hoàn thành & học viên hoạt động */}
          <PanelCard className="p-4 h-[350px]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Tiến độ & Mức tương tác</h3>
              <span className="text-xs text-ink-3">Thống kê theo ngày</span>
            </div>
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={completedByDate}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatCalendarDate} 
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip 
                    labelFormatter={(label) => `Ngày ${formatCalendarDate(label)}`}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="completedCount" name="Bài hoàn thành" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="activeLearners" name="Người học hoạt động" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PanelCard>
        </div>
      ) : (
        isMounted && (
          <PanelCard className="flex h-[200px] flex-col items-center justify-center text-center p-4">
            <p className="text-sm text-ink-3">Không có dữ liệu hoạt động trong khoảng thời gian được chọn.</p>
            <p className="text-xs text-ink-3/70 mt-1">Vui lòng thay đổi khoảng thời gian lọc để xem biểu đồ.</p>
          </PanelCard>
        )
      )}

      {/* 3. BỘ LỌC FLAT B2B DASHBOARD */}
      <PanelCard className="p-4 space-y-4">
        {/* Hàng 1: Preset Date Ranges & Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink-2 uppercase tracking-wider mr-1">Thời gian:</span>
            {[
              { id: "today", label: "Hôm nay" },
              { id: "7d", label: "7 ngày qua" },
              { id: "30d", label: "30 ngày qua" },
              { id: "all", label: "Tất cả" },
              { id: "custom", label: "Tùy chỉnh..." }
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition border ${
                  datePreset === preset.id
                    ? "bg-brand text-white border-brand"
                    : "bg-card text-ink-2 border-line hover:bg-secondary/40"
                }`}
              >
                {preset.label}
              </button>
            ))}

            {/* Hiển thị Range Date Picker khi chọn custom */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-2 ml-2 animate-fade-in">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 rounded-lg border border-line bg-card px-2.5 text-xs text-ink outline-none focus:border-brand"
                />
                <span className="text-xs text-ink-3">—</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 rounded-lg border border-line bg-card px-2.5 text-xs text-ink outline-none focus:border-brand"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-ink-2 hover:bg-secondary/40 disabled:opacity-50"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || !summary}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Đang xuất..." : "Xuất báo cáo Excel"}
            </button>
          </div>
        </div>

        {/* Hàng 2: Search & Filter fields */}
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="flex-1 min-w-[240px]">
            <ListSearchField
              label="Tìm kiếm học viên"
              value={query}
              onChange={setQuery}
              placeholder="Nhập tên, email hoặc vai trò..."
            />
          </div>

          <div className="w-[180px]">
            <ListSelectField
              label="Lọc vai trò"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "all", label: "Tất cả vai trò" },
                { value: "kinh-doanh", label: "Kinh doanh" },
                { value: "ke-toan", label: "Kế toán" },
                { value: "marketing", label: "Marketing" },
                { value: "van-hanh", label: "Vận hành" },
                { value: "nhan-su", label: "Nhân sự" },
                { value: "khac", label: "Khác" },
              ]}
            />
          </div>

          <div className="w-[170px]">
            <ListSelectField
              label="Trạng thái kích hoạt"
              value={activationFilter}
              onChange={setActivationFilter}
              options={[
                { value: "all", label: "Tất cả trạng thái" },
                { value: "activated", label: "Đã kích hoạt" },
                { value: "pending", label: "Chưa kích hoạt" },
              ]}
            />
          </div>

          <div className="w-[180px]">
            <ListSelectField
              label="Tiến độ lộ trình"
              value={progressFilter}
              onChange={setProgressFilter}
              options={[
                { value: "all", label: "Tất cả tiến độ" },
                { value: "none", label: "Chưa bắt đầu" },
                { value: "learning", label: "Đang tiến hành" },
                { value: "completed", label: "Đã hoàn thành" },
                { value: "strong", label: "Tiến độ đạt ≥ 70%" },
              ]}
            />
          </div>

          {query || roleFilter !== "all" || activationFilter !== "all" || progressFilter !== "all" ? (
            <div className="h-9 flex items-center">
              <ClearFiltersButton
                onClick={() => {
                  setQuery("");
                  setRoleFilter("all");
                  setActivationFilter("all");
                  setProgressFilter("all");
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Số kết quả lọc */}
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-3 py-1 font-semibold">
            <Search className="h-3.5 w-3.5" />
            Tìm thấy {filteredRows.length} học viên
          </span>
          {fromDate || toDate ? (
            <span className="inline-flex items-center gap-1 text-brand/80">
              <Calendar className="h-3.5 w-3.5" />
              Lọc theo ngày: {fromDate ? formatCalendarDate(fromDate) : "Bắt đầu"} — {toDate ? formatCalendarDate(toDate) : "Hiện tại"}
            </span>
          ) : null}
        </div>
      </PanelCard>

      {/* 4. BẢNG DỮ LIỆU ĐO LƯỜNG */}
      <PanelCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1160px] w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <Th>Học viên</Th>
                <Th>Vai trò</Th>
                <Th>Kích hoạt</Th>
                <Th>Tiến độ học tập</Th>
                <Th>Kiểm tra MCQ</Th>
                <Th>Lượt chat AI</Th>
                <Th>Giờ tiết kiệm</Th>
                <Th>Điểm</Th>
                <Th>Số ngày HĐ</Th>
                <Th>Phiên học</Th>
                <Th>Truy cập gần nhất</Th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.items.map((r) => (
                <tr key={r.userId} className="border-t border-line hover:bg-secondary/10 transition">
                  <Td>
                    <p className="font-semibold text-ink">{r.name}</p>
                    <p className="text-xs text-ink-3">{r.email}</p>
                  </Td>
                  <Td className="capitalize">{r.roleId ? r.roleId.replace("-", " ") : "—"}</Td>
                  <Td>
                    <StatusBadge
                      value={r.activated ? "activated" : "pending"}
                      label={r.activated ? "Đã kích hoạt" : "Chưa"}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{r.percent}%</span>
                      <span className="text-xs text-ink-3">
                        ({r.completedCount}/{r.selectedCount || "—"})
                      </span>
                    </div>
                  </Td>
                  <Td>
                    {r.quizCount > 0 ? (
                      <span className="text-xs">
                        TB <strong className="text-ink font-semibold">{r.quizAvg}</strong> · đạt {r.quizPassed}/{r.quizCount}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td className="font-semibold">{formatNumber(r.chatCount)}</Td>
                  <Td className="font-semibold text-emerald-600">{r.hoursSaved}h</Td>
                  <Td>{formatNumber(r.points)}</Td>
                  <Td>{formatNumber(r.activeDays)}</Td>
                  <Td>
                    {r.sessionCount > 0 ? (
                      <span className="text-xs">
                        {r.sessionCount} · TB {r.avgSessionMin}&apos;
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td className="text-xs text-ink-2">
                    {formatDate(r.lastActivityAt ?? r.lastSignIn)}
                  </Td>
                </tr>
              ))}
              {paginatedRows.items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-ink-3">
                    Không tìm thấy dữ liệu học viên phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {/* Phân trang */}
      {filteredRows.length > 0 && (
        <PaginationBar
          start={paginatedRows.start}
          end={paginatedRows.end}
          total={paginatedRows.totalItems}
          page={paginatedRows.page}
          totalPages={paginatedRows.totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50]}
        />
      )}
    </section>
  );
}

function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 shadow-sm hover:shadow-md transition">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold text-ink">{value}</p>
    </div>
  );
}
