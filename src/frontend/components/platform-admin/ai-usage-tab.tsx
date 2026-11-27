"use client";

import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import { 
  MetricMini, 
  PanelCard, 
  formatNumber, 
  StatusDot,
  InsightAlert
} from "@/components/platform-admin/platform-admin-console-ui";
import { Cpu, MessageSquare, Hourglass, Award, Zap, Activity } from "lucide-react";

export function AiUsageTab({ vm }: { vm: PlatformAdminConsoleVM }) {
  const report = vm.report;
  if (!report) return null;

  const openaiConfigured = report.platform.openaiConfigured;
  const rateLimit = report.platform.rateLimitPerDay;
  const chat7d = report.overview.chatUsage7d;
  const chat30d = report.overview.chatUsage30d;
  
  // Approximate daily requests from 7d usage
  const approxDailyUsage = Math.round(chat7d / 7);
  const rateLimitPercent = rateLimit > 0 ? Math.min(100, Math.round((approxDailyUsage / rateLimit) * 100)) : 0;

  // Let's compute a trend for chat (7d vs 30d scaled)
  const chatAvg7d = chat7d / 7;
  const chatAvg30d = chat30d / 30;
  const chatRatio = chatAvg30d > 0 ? (chatAvg7d / chatAvg30d) - 1 : 0;
  const chatTrendPercent = Math.abs(Math.round(chatRatio * 100));
  const chatTrendDirection = chatRatio >= 0 ? "up" as const : "down" as const;
  const chatTrendText = chatRatio >= 0 ? `+${chatTrendPercent}% tuần này` : `-${chatTrendPercent}% tuần này`;

  return (
    <section className="mt-6 space-y-6 animate-in fade-in duration-300">
      {/* OpenAI Health & Config Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card/60 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Cổng kết nối OpenAI</h3>
            <p className="text-xs text-ink-2 mt-0.5">Trạng thái cấu hình dịch vụ Generative AI của hệ thống</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-secondary/30 px-3 py-1.5 text-xs font-semibold">
            <StatusDot status={openaiConfigured ? "success" : "danger"} />
            <span className="text-ink ml-1">{openaiConfigured ? "Đang hoạt động" : "Mất kết nối"}</span>
          </div>
          {openaiConfigured && (
            <span className="text-xs font-bold text-ink-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-md">
              {report.platform.openaiModel}
            </span>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* AI Metrics Grid */}
          <PanelCard className="p-6">
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2 mb-4 border-b border-line/40 pb-4">
              <MessageSquare className="h-5 w-5 text-brand" />
              Chỉ số tương tác AI
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricMini 
                label="Hội thoại (7 ngày)" 
                value={chat7d} 
                status="info"
                trend={chatTrendText}
                trendDirection={chatTrendDirection}
              />
              <MetricMini 
                label="Hội thoại (30 ngày)" 
                value={chat30d} 
                status="default"
              />
              <MetricMini 
                label="Quiz trung bình" 
                value={report.overview.quizAvgScore} 
                suffix="/100"
                status={report.overview.quizAvgScore >= 75 ? "success" : "warning"}
              />
              <MetricMini 
                label="Thời gian tiết kiệm" 
                value={Math.round(report.overview.totalHoursSaved)} 
                suffix=" giờ"
                status="success"
              />
              <MetricMini 
                label="Số lượt làm Quiz" 
                value={report.overview.quizCount} 
                status="info"
              />
              <MetricMini 
                label="Người quan tâm (Leads)" 
                value={report.overview.leads} 
                status="default"
              />
            </div>
          </PanelCard>

          {/* Rate Limit visual gauge */}
          <PanelCard className="p-6">
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-amber-500" />
              Hạn mức API hệ thống (Rate Limit)
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold text-ink">Yêu cầu ước lượng mỗi ngày</span>
                  <p className="text-xs text-ink-2 mt-0.5">Dựa trên trung bình tần suất 7 ngày qua</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-ink">{formatNumber(approxDailyUsage)}</span>
                  <span className="text-ink-2"> / {formatNumber(rateLimit)} req/ngày</span>
                </div>
              </div>

              {/* Pure CSS Progress Bar */}
              <div className="h-3 w-full bg-secondary/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-brand to-purple-500 transition-all duration-500 rounded-full"
                  style={{ width: `${rateLimitPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-ink-2">
                <span>Hạn mức sử dụng hiện tại: <strong className="text-ink">{rateLimitPercent}%</strong></span>
                <span>Khả dụng: <strong className="text-emerald-600">{formatNumber(rateLimit - approxDailyUsage)} yêu cầu</strong></span>
              </div>
            </div>
          </PanelCard>
        </div>

        {/* Highlight content summary */}
        <div className="flex flex-col">
          <PanelCard variant="glass" className="p-6 flex flex-col justify-between h-full">
            <div>
              <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2 mb-4 border-b border-line/40 pb-4">
                <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Tổng quan nội dung AI
              </h3>
              
              <div className="space-y-4 text-sm">
                <div className="rounded-xl border border-line bg-secondary/10 p-3.5 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-ink-2">Module bài giảng:</span>
                    <strong className="text-ink font-bold">{formatNumber(report.overview.totalModules)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-ink-2">Lộ trình tùy biến:</span>
                    <strong className="text-ink font-bold">{formatNumber(report.overview.totalPaths)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-ink-2">Bài đánh giá:</span>
                    <strong className="text-ink font-bold">{formatNumber(report.overview.assessments)}</strong>
                  </div>
                  <div className="h-px bg-line/40 my-2" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-ink-2">Hàng đợi chấm bài:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${report.overview.gradingQueue > 0 ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"}`}>
                      {report.overview.gradingQueue} bài
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-xs">
                    <Award className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 animate-pulse" />
                    <p className="text-ink-2 leading-relaxed">
                      Đã ghi nhận <strong className="text-ink font-semibold">{formatNumber(report.overview.ahaReflections)} khoảnh khắc &quot;Aha&quot;</strong> trong quá trình nhân viên tự phản hồi.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Hourglass className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-ink-2 leading-relaxed">
                      Công cụ AI đã tối ưu hóa tương đương <strong className="text-ink font-semibold">{formatNumber(report.overview.totalHoursSaved)} giờ học tập/ôn tập</strong> cho nhân viên.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-line/40">
              <InsightAlert 
                severity="info"
                message="Tần suất sử dụng AI được cập nhật thời gian thực dựa trên các API log."
                className="text-xs p-3 rounded-xl border-line/50"
              />
            </div>
          </PanelCard>
        </div>
      </div>
    </section>
  );
}
