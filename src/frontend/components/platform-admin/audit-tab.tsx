"use client";

import { useMemo } from "react";
import {
  Activity,
  Database,
  Key,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import {
  ClearFiltersButton,
  ListSearchField,
  ListSelectField,
  PaginationBar,
} from "@/components/platform-admin/platform-admin-list-primitives";
import { EmptyState, PanelCard } from "@/components/platform-admin/platform-admin-console-ui";
import { cn } from "@/lib/utils";

function getAuditStyle(action: string) {
  switch (action) {
    case "delete-users":
      return {
        icon: Trash2,
        iconClass: "text-rose-600 bg-rose-50 border-rose-200",
      };
    case "reset-user-learning":
      return {
        icon: RefreshCw,
        iconClass: "text-amber-600 bg-amber-50 border-amber-200",
      };
    case "rotate-invite-link":
      return {
        icon: Key,
        iconClass: "text-orange-600 bg-orange-50 border-orange-200",
      };
    case "create-organization-admin":
    case "toggle-platform-admin":
      return {
        icon: Users,
        iconClass: "text-indigo-600 bg-indigo-50 border-indigo-200",
      };
    case "update-user":
    case "set-user-activation":
    case "bulk-set-activation":
      return {
        icon: User,
        iconClass: "text-sky-600 bg-sky-50 border-sky-200",
      };
    case "toggle-organization-status":
    case "update-organization":
      return {
        icon: Database,
        iconClass: "text-emerald-600 bg-emerald-50 border-emerald-200",
      };
    default:
      return {
        icon: Activity,
        iconClass: "text-slate-600 bg-slate-50 border-slate-200",
      };
  }
}

export function AuditTab({ vm }: { vm: PlatformAdminConsoleVM }) {
  const report = vm.report;

  const auditActionOptions = useMemo(() => {
    const list = report?.audits ?? [];
    return Array.from(
      new Map(
        list
          .map((entry) => [entry.action, entry.actionLabel] as const)
          .filter(([action]) => Boolean(action)),
      ).entries(),
    )
      .map(([action, label]) => ({ action, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [report?.audits]);

  const auditOrganizationOptions = useMemo(() => {
    const list = report?.audits ?? [];
    return Array.from(
      new Set(
        list
          .map((entry) => entry.organizationName)
          .filter(Boolean)
      )
    ).sort((a, b) => (a as string).localeCompare(b as string, "vi"));
  }, [report?.audits]);

  const auditActorOptions = useMemo(() => {
    const list = report?.audits ?? [];
    return Array.from(
      new Set(
        list
          .map((entry) => entry.actor)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "vi"));
  }, [report?.audits]);

  if (!report) return null;

  return (
    <section className="mt-6 space-y-4">
      <PanelCard className="p-5">
        <h2 className="font-display text-xl font-bold text-ink">Nhật ký hoạt động</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ListSearchField
            label="Tìm nhật ký hoạt động"
            value={vm.auditQuery}
            onChange={vm.setAuditQuery}
            placeholder="Tìm actor, action, chi tiết…"
          />
          <ListSelectField
            label="Lọc hành động"
            value={vm.auditActionFilter || "all"}
            onChange={(value) => vm.setAuditActionFilter(value === "all" ? "" : value)}
            options={[
              { value: "all", label: "Tất cả hành động" },
              ...auditActionOptions.map(({ action, label }) => ({ value: action, label })),
            ]}
            className="min-w-[200px]"
          />
          <ListSelectField
            label="Lọc tổ chức"
            value={vm.auditOrganizationFilter || "all"}
            onChange={(value) => vm.setAuditOrganizationFilter(value)}
            options={[
              { value: "all", label: "Tất cả tổ chức" },
              ...auditOrganizationOptions.map((org) => ({ value: org as string, label: org as string })),
            ]}
            className="min-w-[180px]"
          />
          <ListSelectField
            label="Lọc người thực hiện"
            value={vm.auditActorFilter || "all"}
            onChange={(value) => vm.setAuditActorFilter(value)}
            options={[
              { value: "all", label: "Tất cả người thực hiện" },
              ...auditActorOptions.map((actor) => ({ value: actor, label: actor })),
            ]}
            className="min-w-[200px]"
          />
          
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-2">Từ ngày</span>
            <input
              type="date"
              value={vm.auditFromDate}
              onChange={(e) => vm.setAuditFromDate(e.target.value)}
              className="h-10 rounded-xl border border-line bg-card px-3 text-sm text-ink transition-all duration-200 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 cursor-pointer"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-2">Đến ngày</span>
            <input
              type="date"
              value={vm.auditToDate}
              onChange={(e) => vm.setAuditToDate(e.target.value)}
              className="h-10 rounded-xl border border-line bg-card px-3 text-sm text-ink transition-all duration-200 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 cursor-pointer"
            />
          </label>
          {vm.auditQuery || vm.auditActionFilter || vm.auditOrganizationFilter !== "all" || vm.auditActorFilter !== "all" || vm.auditFromDate || vm.auditToDate ? (
            <div className="flex flex-col justify-end pt-5">
              <ClearFiltersButton
                onClick={() => {
                  vm.setAuditQuery("");
                  vm.setAuditActionFilter("");
                  vm.setAuditOrganizationFilter("all");
                  vm.setAuditActorFilter("all");
                  vm.setAuditFromDate("");
                  vm.setAuditToDate("");
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-2.5 py-1">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {vm.paginatedAudits.totalItems} kết quả
          </span>
        </div>

        <div className="mt-6">
          {vm.paginatedAudits.items.length === 0 ? (
            <EmptyState
              title="Chưa có bản ghi audit nào khớp bộ lọc."
              description="Mở rộng điều kiện tìm kiếm hoặc đợi hệ thống phát sinh thao tác mới."
            />
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:bottom-2 before:top-2 before:left-[11px] before:w-[2px] before:bg-line/60">
              {vm.paginatedAudits.items.map((entry) => {
                const { icon: Icon, iconClass } = getAuditStyle(entry.action);
                return (
                  <div key={entry.id} className="relative group">
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-card shadow-sm z-10">
                      <div className={cn("flex h-5 w-5 items-center justify-center rounded-full border text-[10px] shadow-sm", iconClass)}>
                        <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                      </div>
                    </div>
                    {/* Content Card */}
                    <div className="ml-3 rounded-2xl border border-line bg-card p-4 transition-all hover:border-brand-soft hover:shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-ink">
                            {entry.actor} <span className="mx-1 text-ink-3 font-normal">đã thực hiện</span> {entry.actionLabel}
                          </p>
                          <p className="font-mono text-[10px] text-ink-3 bg-secondary/50 px-2 py-0.5 rounded-md inline-block">
                            {entry.action}
                          </p>
                        </div>
                        <span className="text-[11px] text-ink-3 font-medium bg-secondary/40 px-2.5 py-1 rounded-full whitespace-nowrap">
                          {new Date(entry.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                        </span>
                      </div>
                      
                      <div className="mt-3 text-xs text-ink-2 space-y-2">
                        {entry.detail && (
                          <div className="rounded-xl bg-secondary/15 px-3 py-2 text-xs font-mono text-ink-2 border border-line/40 break-all leading-relaxed whitespace-pre-wrap">
                            {entry.detail}
                          </div>
                        )}
                        {entry.organizationName && (
                          <p className="text-xs text-ink-3 font-medium">
                            Tổ chức liên quan: <span className="font-semibold text-ink-2 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">{entry.organizationName}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PanelCard>

      <PaginationBar
        start={vm.paginatedAudits.start}
        end={vm.paginatedAudits.end}
        total={vm.paginatedAudits.totalItems}
        page={vm.paginatedAudits.page}
        totalPages={vm.paginatedAudits.totalPages}
        pageSize={vm.auditPageSize}
        onPageChange={vm.setAuditPage}
        onPageSizeChange={vm.setAuditPageSize}
      />
    </section>
  );
}
