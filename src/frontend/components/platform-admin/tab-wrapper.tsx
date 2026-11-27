"use client";

import type { PlatformAdminTabKey } from "@/components/platform-admin/platform-admin-console.types";
import { ConfirmActionDialog } from "@/components/platform-admin/confirm-action-dialog";
import { PlatformAdminConsoleSkeleton } from "@/components/platform-admin/platform-admin-console-skeleton";
import { ToastBanner } from "@/components/platform-admin/platform-admin-console-ui";
import { usePlatformAdminConsole } from "@/hooks/use-platform-admin-console";

// Import 9 tab components trực tiếp để render client-side tránh serialization errors
import { OverviewTab } from "@/components/platform-admin/overview-tab";
import { OrganizationsTab } from "@/components/platform-admin/organizations-tab";
import { UsersTab } from "@/components/platform-admin/users-tab";
import { ContentTab } from "@/components/platform-admin/content-tab";
import { LearningMetricsTab } from "@/components/platform-admin/learning-metrics-tab";
import { AhaReflectionsTab } from "@/components/platform-admin/aha-reflections-tab";
import { AiUsageTab } from "@/components/platform-admin/ai-usage-tab";
import { AuditTab } from "@/components/platform-admin/audit-tab";
import { BitemporalAdminTab } from "@/components/platform-admin/bitemporal-admin-tab";
import { SiteSettingsTab } from "@/components/platform-admin/site-settings-tab";

export function PlatformAdminTabWrapper({
  tabKey,
}: {
  tabKey: PlatformAdminTabKey;
}) {
  const vm = usePlatformAdminConsole(tabKey);
  const report = vm.report;

  if (vm.loading) {
    return <PlatformAdminConsoleSkeleton />;
  }

  // Render tab content client-side dựa trên tabKey
  const renderTabContent = () => {
    switch (tabKey) {
      case "tong-quan":
        return <OverviewTab vm={vm} />;
      case "to-chuc":
        return <OrganizationsTab vm={vm} />;
      case "nguoi-dung":
        return <UsersTab vm={vm} />;
      case "noi-dung":
        return <ContentTab vm={vm} />;
      case "do-luong":
        return <LearningMetricsTab />;
      case "aha-moment":
        return <AhaReflectionsTab vm={vm} />;
      case "ai-usage":
        return <AiUsageTab vm={vm} />;
      case "nhat-ky":
        return <AuditTab vm={vm} />;
      case "bitemporal":
        return <BitemporalAdminTab users={report?.users ?? []} />;
      case "cai-dat":
        return <SiteSettingsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col flex-1">
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

      <div aria-busy={vm.loading || vm.refreshing} className="flex-1">
        {renderTabContent()}
      </div>

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
