"use client";

import { RefreshCw, Shield, Users } from "lucide-react";
import { usePlatformAdminConsole } from "@/hooks/use-platform-admin-console";
import { ConfirmActionDialog } from "@/components/platform-admin/confirm-action-dialog";
import { PlatformAdminConsoleSkeleton } from "@/components/platform-admin/platform-admin-console-skeleton";
import { ToastBanner } from "@/components/platform-admin/platform-admin-console-ui";
import { OverviewTab } from "@/components/platform-admin/overview-tab";
import { OrganizationsTab } from "@/components/platform-admin/organizations-tab";
import { UsersTab } from "@/components/platform-admin/users-tab";
import { ContentTab } from "@/components/platform-admin/content-tab";
import { AiUsageTab } from "@/components/platform-admin/ai-usage-tab";
import { AuditTab } from "@/components/platform-admin/audit-tab";
import { LearningMetricsTab } from "@/components/platform-admin/learning-metrics-tab";
import { BitemporalAdminTab } from "@/components/platform-admin/bitemporal-admin-tab";
import { AhaReflectionsTab } from "@/components/platform-admin/aha-reflections-tab";

const tabs = [
  { key: "tong-quan", label: "Tổng quan" },
  { key: "to-chuc", label: "Tổ chức" },
  { key: "nguoi-dung", label: "Người dùng" },
  { key: "noi-dung", label: "Nội dung" },
  { key: "do-luong", label: "Đo lường học tập" },
  { key: "aha-moment", label: "Aha Moment" },
  { key: "ai-usage", label: "AI & sử dụng" },
  { key: "nhat-ky", label: "Nhật ký" },
  { key: "bitemporal", label: "Bitemporal Memory" },
] as const;

export function PlatformAdminConsole() {
  const vm = usePlatformAdminConsole();
  const report = vm.report;

  if (vm.loading) {
    return <PlatformAdminConsoleSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <header className="border-b border-line pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-brand">
                <Shield className="h-3.5 w-3.5" />
                Platform Admin Console
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1">
                <Users className="h-3.5 w-3.5" />
                super-admin
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1">
                <RefreshCw className="h-3.5 w-3.5" />
                {vm.refreshing ? "Đang làm mới" : "Sẵn sàng"}
              </span>
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-ink">Vận hành hệ thống</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-2">
                Bảng điều khiển này gom toàn bộ dữ liệu nền tảng, tổ chức, người dùng, nội dung,
                AI usage và audit log vào một nơi để quản trị hệ thống làm việc nhanh hơn.
              </p>
            </div>
          </div>

          {report ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1">
                <RefreshCw className="h-3.5 w-3.5" />
                {vm.refreshing ? "Đang làm mới" : "Sẵn sàng"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 normal-case tracking-normal text-ink-2">
                Cập nhật:{" "}
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(report.generatedAt))}
              </span>
            </div>
          ) : null}
        </div>

        <nav
          aria-label="Điều hướng tab vận hành"
          className="mt-5 flex gap-2 border-t border-line pt-4 overflow-x-auto pb-1.5 scroll-smooth whitespace-nowrap"
          style={{ scrollbarWidth: "none" }}
        >
          {tabs.map((item) => {
            const active = vm.tab === item.key;
            
            // Calculate count for this tab
            let count: number | null = null;
            if (report) {
              if (item.key === "to-chuc") count = report.overview.organizations;
              else if (item.key === "nguoi-dung") count = report.overview.users;
              else if (item.key === "noi-dung") count = report.overview.totalModules + report.overview.totalPaths + report.overview.assessments;
              else if (item.key === "aha-moment") count = report.overview.ahaReflections;
            }

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => vm.setTab(item.key)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition shrink-0",
                  active
                    ? "border-brand/20 bg-brand-soft text-brand shadow-sm scale-[1.02]"
                    : "border-line bg-card text-ink-2 hover:border-brand hover:text-brand",
                ].join(" ")}
              >
                <span>{item.label}</span>
                {count !== null && (
                  <span className={`inline-flex items-center justify-center rounded-full text-[10px] px-1.5 py-0.5 font-bold ${
                    active ? "bg-brand text-white" : "bg-secondary text-ink-2"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {report?.message || vm.message || vm.error || !vm.canMutate ? (
        <div className="mt-4 space-y-2">
          {report?.message ? (
            <div className="rounded-2xl border border-brand/15 bg-brand-soft px-4 py-3 text-sm text-brand">
              {report.message}
            </div>
          ) : null}
          {!vm.canMutate ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Demo mode chỉ cho xem dữ liệu. Kết nối Supabase để mở toàn bộ quyền chỉnh sửa.
            </div>
          ) : null}
          {vm.message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {vm.message}
            </div>
          ) : null}
          {vm.error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {vm.error}
            </div>
          ) : null}
        </div>
      ) : null}

      {vm.copiedToken ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          Link mời mới: <span className="font-mono">{vm.copiedToken}</span>
        </div>
      ) : null}

      <main aria-busy={vm.loading || vm.refreshing} className="flex-1">
        {vm.tab === "tong-quan" ? <OverviewTab vm={vm} /> : null}
        {vm.tab === "to-chuc" ? <OrganizationsTab vm={vm} /> : null}
        {vm.tab === "nguoi-dung" ? <UsersTab vm={vm} /> : null}
        {vm.tab === "noi-dung" ? <ContentTab vm={vm} /> : null}
        {vm.tab === "do-luong" ? <LearningMetricsTab /> : null}
        {vm.tab === "aha-moment" ? <AhaReflectionsTab vm={vm} /> : null}
        {vm.tab === "ai-usage" ? <AiUsageTab vm={vm} /> : null}
        {vm.tab === "nhat-ky" ? <AuditTab vm={vm} /> : null}
        {vm.tab === "bitemporal" ? <BitemporalAdminTab users={report?.users ?? []} /> : null}
      </main>

      <ConfirmActionDialog
        open={Boolean(vm.pendingConfirm)}
        onOpenChange={(open) => {
          if (!open) vm.setPendingConfirm(null);
        }}
        config={vm.pendingConfirm}
        onConfirm={vm.resolvePendingConfirm}
        busy={Boolean(vm.savingKey)}
      />

      {vm.toast ? (
        <ToastBanner kind={vm.toast.kind} message={vm.toast.message} onClose={vm.dismissToast} />
      ) : null}
    </div>
  );
}
