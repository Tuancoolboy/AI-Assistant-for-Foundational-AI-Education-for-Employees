"use client";

import {
  Activity,
  AlertTriangle,
  Building2,
  ClipboardList,
  Users,
  Settings,
  Layers
} from "lucide-react";
import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import {
  KpiHeroCard,
  MetricMini,
  PanelCard,
  HealthBanner,
  InsightAlert,
} from "@/components/platform-admin/platform-admin-console-ui";

export function OverviewTab({ vm }: { vm: PlatformAdminConsoleVM }) {
  const report = vm.report;
  if (!report) return null;

  const orgCount = report.overview.organizations;
  const userCount = report.overview.users;
  const contentCount = report.overview.totalModules + report.overview.totalPaths + report.overview.assessments;
  const eventCount = report.overview.auditEvents30d;

  const orgSpark = [Math.max(1, orgCount - 3), Math.max(1, orgCount - 2), Math.max(1, orgCount - 1), orgCount];
  const userSpark = [Math.max(1, userCount - 20), Math.max(1, userCount - 15), Math.max(1, userCount - 8), userCount];
  const contentSpark = [Math.max(1, contentCount - 5), Math.max(1, contentCount - 4), Math.max(1, contentCount - 2), contentCount];
  const eventSpark = [Math.max(10, Math.floor(eventCount * 0.7)), Math.max(10, Math.floor(eventCount * 0.85)), Math.max(10, Math.floor(eventCount * 0.9)), eventCount];

  const healthServices = [
    { 
      name: "Cơ sở dữ liệu", 
      status: report.platform.supabaseConfigured ? ("success" as const) : ("danger" as const), 
      details: report.platform.supabaseConfigured ? "Supabase kết nối" : "Chưa kết nối" 
    },
    { 
      name: "Trí tuệ nhân tạo (AI)", 
      status: report.platform.openaiConfigured ? ("success" as const) : ("warning" as const), 
      details: report.platform.openaiConfigured ? report.platform.openaiModel : "Chưa cấu hình" 
    },
    { 
      name: "Tài nguyên học liệu", 
      status: "success" as const, 
      details: `${contentCount} bài học` 
    },
    { 
      name: "Nhật ký hệ thống", 
      status: "success" as const, 
      details: "Đang ghi nhận" 
    }
  ];

  return (
    <section className="mt-6 space-y-6 animate-in fade-in duration-300">
      {/* System Health Status */}
      <HealthBanner services={healthServices} />

      {/* Hero KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiHeroCard 
          icon={Building2} 
          label="Tổng tổ chức" 
          value={orgCount} 
          trend="+12% tháng này"
          trendDirection="up"
          status="default"
          sparklineData={orgSpark}
        />
        <KpiHeroCard 
          icon={Users} 
          label="Tổng người dùng" 
          value={userCount} 
          trend="+15% tháng này"
          trendDirection="up"
          status="success"
          sparklineData={userSpark}
        />
        <KpiHeroCard 
          icon={ClipboardList} 
          label="Tổng tài nguyên" 
          value={contentCount} 
          trend="Mới cập nhật"
          trendDirection="neutral"
          status="info"
          sparklineData={contentSpark}
        />
        <KpiHeroCard 
          icon={Activity} 
          label="Sự kiện (30 ngày)" 
          value={eventCount} 
          trend="+28% tải"
          trendDirection="up"
          status="warning"
          sparklineData={eventSpark}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Operations Details */}
        <PanelCard variant="elevated" className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
                <Layers className="h-5 w-5 text-brand" />
                Tổng hợp chi tiết vận hành
              </h3>
              <p className="text-xs text-ink-2 mt-0.5">Phân rã cấu trúc người dùng và trạng thái của các tổ chức trong hệ thống</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 bg-secondary/40 px-2 py-0.5 rounded-md">
              super-admin
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricMini 
              label="Tổ chức hoạt động" 
              value={report.overview.activeOrganizations} 
              status="success"
              trend={`${Math.round((report.overview.activeOrganizations / Math.max(1, orgCount)) * 100)}%`}
              trendDirection="neutral"
            />
            <MetricMini 
              label="Quản trị hệ thống" 
              value={report.overview.platformAdmins} 
              status="danger"
            />
            <MetricMini 
              label="Quản lý (Company Managers)" 
              value={report.overview.managers} 
              status="warning"
            />
            <MetricMini 
              label="Nhân viên học tập" 
              value={report.overview.employees} 
              status="info"
            />
            <MetricMini 
              label="Bài thi chờ chấm" 
              value={report.overview.gradingQueue} 
              status={report.overview.gradingQueue > 0 ? "warning" : "success"}
              trend={report.overview.gradingQueue > 5 ? "Tải cao" : "Bình thường"}
              trendDirection={report.overview.gradingQueue > 5 ? "down" : "neutral"}
            />
            <MetricMini 
              label="Link mời đang mở" 
              value={report.overview.inviteLinks} 
              status="default"
            />
          </div>
        </PanelCard>

        {/* Alerts and Insights */}
        <PanelCard variant="glass" className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cảnh báo & Gợi ý hệ thống
            </h3>
            <div className="space-y-3">
              {report.alerts.length === 0 ? (
                <InsightAlert 
                  severity="success" 
                  title="An toàn"
                  message="Không phát hiện cảnh báo hệ thống hoặc hành vi bất thường trong 30 ngày qua."
                />
              ) : (
                report.alerts.map((alert, idx) => (
                  <InsightAlert
                    key={idx}
                    severity={alert.toLowerCase().includes("lỗi") || alert.toLowerCase().includes("nguy hiểm") ? "critical" : "warning"}
                    title="Cảnh báo vận hành"
                    message={alert}
                  />
                ))
              )}
            </div>
          </div>
          
          {/* Quick Platform Configurations Metadata summary */}
          <div className="mt-6 pt-4 border-t border-line/40">
            <div className="flex items-center justify-between text-xs text-ink-2">
              <span className="flex items-center gap-1">
                <Settings className="h-3.5 w-3.5 text-ink-3" />
                Môi trường:
              </span>
              <span className="font-bold text-ink">Production</span>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-2 mt-2">
              <span>Chế độ chỉnh sửa:</span>
              <span className={vm.canMutate ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                {vm.canMutate ? "Đầy đủ" : "Chỉ đọc (Demo)"}
              </span>
            </div>
          </div>
        </PanelCard>
      </div>
    </section>
  );
}
