import * as XLSX from "xlsx";
import type { QuizResultItem, TimeLogItem } from "@/lib/client-api";
import { getRole } from "@/lib/roles";

export interface ExportData {
  profile: {
    fullName: string | null;
    roleId: string | null;
    aiLevel: number;
    levelLabel: string | null;
  };
  logs: TimeLogItem[];
  quizResults: QuizResultItem[];
  totalHours: number;
  avgScore: number;
  percentComplete: number;
  dateFilter?: {
    start: string;
    end: string;
  };
}

export function exportLearningReport(data: ExportData) {
  const { profile, logs, quizResults, totalHours, avgScore, percentComplete, dateFilter } = data;
  const roleName = profile.roleId ? getRole(profile.roleId)?.shortLabel || profile.roleId : "Chưa xác định";

  // Create workbook
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: 01_Tong quan ---
  const overviewData = [
    ["BÁO CÁO TIẾN ĐỘ HỌC TẬP & HIỆU QUẢ SỬ DỤNG AI"],
    [],
    ["Học viên:", profile.fullName || "N/A"],
    ["Vai trò hiện tại:", roleName],
    ["Trình độ AI:", `${profile.aiLevel}/5 (${profile.levelLabel || "Chưa đánh giá"})`],
    ["Thời gian xuất báo cáo:", new Date().toLocaleString("vi-VN")],
    [],
    ["CHỈ SỐ HIỆU SUẤT CHÍNH (KPI)"],
    ["Chỉ số", "Giá trị", "Đơn vị", "Đánh giá"],
    ["Tổng thời gian tiết kiệm", totalHours.toFixed(1), "giờ", "Đạt hiệu suất tốt từ AI"],
    ["Điểm kiểm tra trung bình", avgScore > 0 ? avgScore.toFixed(0) : "N/A", "điểm", avgScore >= 80 ? "Xuất sắc" : avgScore >= 50 ? "Đạt" : "Cần cải thiện"],
    ["Tiến độ hoàn thành lộ trình", `${percentComplete}%`, "lộ trình", percentComplete === 100 ? "Hoàn thành xuất sắc" : "Đang tiến hành"],
    [],
    ["Khoảng thời gian báo cáo:", dateFilter ? `${formatSimpleDate(dateFilter.start)} - ${formatSimpleDate(dateFilter.end)}` : "Tất cả thời gian"],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  
  // Set simple column widths
  wsOverview["!cols"] = [
    { wch: 30 },
    { wch: 25 },
    { wch: 15 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsOverview, "01_Tong quan");

  // --- SHEET 2: 02_Data sach ---
  const rawLogsData = [
    ["NHẬT KÝ SỬ DỤNG AI & TIẾT KIỆM THỜI GIAN CÁ NHÂN"],
    [],
    ["Mã log", "Số giờ tiết kiệm", "Độ hữu ích (1-10)", "Thời gian ghi nhận", "Ghi chú"]
  ];
  logs.forEach((log) => {
    rawLogsData.push([
      log.id,
      log.hoursSaved.toString(),
      (log.usefulness ?? "N/A").toString(),
      new Date(log.loggedAt).toLocaleString("vi-VN"),
      log.note || "Không có ghi chú"
    ]);
  });
  const wsLogs = XLSX.utils.aoa_to_sheet(rawLogsData);
  wsLogs["!cols"] = [
    { wch: 15 },
    { wch: 20 },
    { wch: 18 },
    { wch: 25 },
    { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsLogs, "02_Data sach");

  // --- SHEET 3: 03_Xep hang hoc vien ---
  const quizData = [
    ["LỊCH SỬ KIỂM TRA MCQ"],
    [],
    ["Mã bài làm", "Vai trò (Role ID)", "Điểm số (/100)", "Kết quả", "Thời gian làm bài"]
  ];
  quizResults.forEach((q) => {
    const qRole = getRole(q.roleId);
    quizData.push([
      q.id,
      qRole?.shortLabel || q.roleId,
      q.score.toString(),
      q.passed ? "ĐẠT" : "CHƯA ĐẠT",
      new Date(q.createdAt).toLocaleString("vi-VN")
    ]);
  });
  const wsQuiz = XLSX.utils.aoa_to_sheet(quizData);
  wsQuiz["!cols"] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsQuiz, "03_Xep hang hoc vien");

  // --- DAILY SHEETS: D15-06, D16-06, etc. (If dates exist) ---
  const dailyData: Record<string, { logs: TimeLogItem[]; quizzes: QuizResultItem[] }> = {};

  logs.forEach((log) => {
    const dateStr = formatExcelDateKey(log.loggedAt); // "D15-06"
    if (!dailyData[dateStr]) {
      dailyData[dateStr] = { logs: [], quizzes: [] };
    }
    dailyData[dateStr].logs.push(log);
  });

  quizResults.forEach((q) => {
    const dateStr = formatExcelDateKey(q.createdAt);
    if (!dailyData[dateStr]) {
      dailyData[dateStr] = { logs: [], quizzes: [] };
    }
    dailyData[dateStr].quizzes.push(q);
  });

  // Sort dates to match chronological order
  const sortedDates = Object.keys(dailyData).sort((a, b) => {
    const parseDayMonth = (d: string) => {
      const parts = d.substring(1).split("-"); // ["15", "06"]
      return parseInt(parts[1]) * 100 + parseInt(parts[0]);
    };
    return parseDayMonth(a) - parseDayMonth(b);
  });

  sortedDates.forEach((dateKey) => {
    const dayObj = dailyData[dateKey];
    const sheetData = [
      [`CHI TIẾT HOẠT ĐỘNG NGÀY ${dateKey.substring(1).replace("-", "/")}`],
      [],
      ["NHẬT KÝ TIẾT KIỆM GIỜ"],
      ["Số giờ tiết kiệm", "Độ hữu ích", "Thời gian ghi nhận", "Ghi chú"]
    ];

    dayObj.logs.forEach((log) => {
      sheetData.push([
        log.hoursSaved.toString(),
        (log.usefulness ?? "N/A").toString(),
        new Date(log.loggedAt).toLocaleTimeString("vi-VN"),
        log.note || ""
      ]);
    });

    if (dayObj.quizzes.length > 0) {
      sheetData.push([]);
      sheetData.push(["KẾT QUẢ BÀI KIỂM TRONG NGÀY"]);
      sheetData.push(["Vai trò", "Điểm số", "Kết quả", "Thời gian"]);
      dayObj.quizzes.forEach((q) => {
        const qRole = getRole(q.roleId);
        sheetData.push([
          qRole?.shortLabel || q.roleId,
          q.score.toString(),
          q.passed ? "ĐẠT" : "CHƯA ĐẠT",
          new Date(q.createdAt).toLocaleTimeString("vi-VN")
        ]);
      });
    }

    const wsDaily = XLSX.utils.aoa_to_sheet(sheetData);
    wsDaily["!cols"] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
      { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDaily, dateKey);
  });

  // --- SHEET 4: 04_Review gia tri report ---
  const reviewData = [
    ["ĐÁNH GIÁ VÀ ĐỀ XUẤT PHÁT TRIỂN NĂNG LỰC AI"],
    [],
    ["Học viên:", profile.fullName || "N/A"],
    ["Đánh giá chung:", totalHours > 10 ? "Mức độ ứng dụng AI cao. Tiếp tục phát huy!" : "Hãy tích cực sử dụng AI hơn để tối ưu hóa công việc."],
    [],
    ["Đề xuất lộ trình tiếp theo:"],
    ["1. Hoàn thành các module còn lại trong bộ kỹ năng để đạt 100% lộ trình."],
    ["2. Luyện tập thi trắc nghiệm MCQ để nâng cao điểm trung bình lên trên 80."],
    ["3. Đặt lịch sử dụng AI làm trợ lý hàng ngày cho các tác vụ viết code, phân tích dữ liệu, tóm tắt tài liệu."],
    [],
    ["Báo cáo được khởi tạo tự động bởi AI Trợ Lý."]
  ];
  const wsReview = XLSX.utils.aoa_to_sheet(reviewData);
  wsReview["!cols"] = [
    { wch: 60 }
  ];
  XLSX.utils.book_append_sheet(wb, wsReview, "04_Review gia tri report");

  // Generate date strings for file name
  const dateStr = dateFilter
    ? `${formatSimpleDateFile(dateFilter.start)}_${formatSimpleDateFile(dateFilter.end)}`
    : `${formatSimpleDateFile(new Date().toISOString())}`;
  const fileName = `bao_cao_tien_do_hoc_tap_${dateStr}.xlsx`;

  // Write and trigger download
  XLSX.writeFile(wb, fileName);
}

// Helpers
function formatSimpleDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

function formatSimpleDateFile(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}_${(d.getMonth() + 1).toString().padStart(2, "0")}_${d.getFullYear()}`;
}

function formatExcelDateKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `D${day}-${month}`; // matches D15-06 format
}
