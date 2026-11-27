"use client";

import { useMemo } from "react";
import { CalendarDays, Download, Eye, Lightbulb, Search, Share2 } from "lucide-react";
import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import { downloadAhaReflectionsCsv } from "@/lib/platform-admin-aha-export";
import {
  ClearFiltersButton,
  ListSearchField,
  ListSelectField,
  PaginationBar,
  StatusBadge,
  ToolbarField,
} from "@/components/platform-admin/platform-admin-list-primitives";
import {
  EmptyState,
  MetricCard,
  PanelCard,
  SectionTitle,
  Td,
  Th,
  formatDate,
} from "@/components/platform-admin/platform-admin-console-ui";

const VISIBILITY_LABELS = {
  private: "Riêng tư",
  department: "Phòng ban",
  company: "Công ty",
} as const;

export function AhaReflectionsTab({ vm }: { vm: PlatformAdminConsoleVM }) {
  const report = vm.report;

  const { sharedCount, privateCount, organizationOptions } = useMemo(() => {
    const list = report?.ahaReflections ?? [];
    const shared = list.filter(
      (reflection) => reflection.visibility !== "private",
    ).length;
    const priv = list.length - shared;
    const orgs = Array.from(
      new Map(
        list
          .filter(
            (reflection) =>
              Boolean(reflection.organizationId) && Boolean(reflection.organizationName),
          )
          .map((reflection) => [
            reflection.organizationId as string,
            reflection.organizationName as string,
          ]),
      ),
    )
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
    return { sharedCount: shared, privateCount: priv, organizationOptions: orgs };
  }, [report?.ahaReflections]);

  if (!report) return null;

  return (
    <section className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Lightbulb} label="Tổng Aha Moment" value={report.ahaReflections.length} />
        <MetricCard icon={Eye} label="Riêng tư" value={privateCount} />
        <MetricCard icon={Share2} label="Đã chia sẻ" value={sharedCount} />
      </div>

      <PanelCard className="p-5">
        <SectionTitle
          title="Khoảnh khắc Aha"
          subtitle="Xem phản tư quan trọng sau bài học. Nội dung riêng tư chỉ phục vụ vận hành có thẩm quyền."
          action={
            <button
              type="button"
              aria-label="Tải file CSV Aha Moment"
              disabled={vm.filteredAhaReflections.length === 0}
              onClick={() => downloadAhaReflectionsCsv(vm.filteredAhaReflections)}
              className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Tải Excel (.csv)
            </button>
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ListSearchField
            label="Tìm Aha Moment"
            value={vm.ahaQuery}
            onChange={vm.setAhaQuery}
            placeholder="Tìm người học, module, nội dung..."
          />
          <ListSelectField
            label="Lọc theo phạm vi"
            value={vm.ahaVisibilityFilter}
            onChange={(value) =>
              vm.setAhaVisibilityFilter(value as typeof vm.ahaVisibilityFilter)
            }
            options={[
              { value: "all", label: "Tất cả phạm vi" },
              { value: "private", label: "Riêng tư" },
              { value: "department", label: "Phòng ban" },
              { value: "company", label: "Công ty" },
            ]}
          />
          <ListSelectField
            label="Lọc theo tổ chức"
            value={vm.ahaOrganizationFilter}
            onChange={vm.setAhaOrganizationFilter}
            options={[
              { value: "all", label: "Tất cả tổ chức" },
              ...organizationOptions,
            ]}
          />
          <ToolbarField
            icon={CalendarDays}
            label="Lọc từ ngày"
            className="min-w-[180px] flex-none"
          >
            <input
              type="date"
              name="aha-from-date"
              autoComplete="off"
              aria-label="Lọc Aha Moment từ ngày"
              value={vm.ahaFromDate}
              onChange={(event) => vm.setAhaFromDate(event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </ToolbarField>
          <ToolbarField
            icon={CalendarDays}
            label="Lọc đến ngày"
            className="min-w-[180px] flex-none"
          >
            <input
              type="date"
              name="aha-to-date"
              autoComplete="off"
              aria-label="Lọc Aha Moment đến ngày"
              value={vm.ahaToDate}
              onChange={(event) => vm.setAhaToDate(event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </ToolbarField>
          {vm.ahaQuery ||
          vm.ahaVisibilityFilter !== "all" ||
          vm.ahaOrganizationFilter !== "all" ||
          vm.ahaFromDate ||
          vm.ahaToDate ? (
            <ClearFiltersButton
              onClick={() => {
                vm.setAhaQuery("");
                vm.setAhaVisibilityFilter("all");
                vm.setAhaOrganizationFilter("all");
                vm.setAhaFromDate("");
                vm.setAhaToDate("");
              }}
            />
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-2.5 py-1">
            <Search className="h-3.5 w-3.5" />
            {vm.paginatedAhaReflections.totalItems} kết quả
          </span>
          <span>File tải xuống gồm toàn bộ kết quả đang lọc, không chỉ trang hiện tại.</span>
        </div>
      </PanelCard>

      <PanelCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <Th>Thời gian</Th>
                <Th>Người học</Th>
                <Th>Tổ chức</Th>
                <Th>Module</Th>
                <Th>Điều hiểu ra</Th>
                <Th>Hành động tiếp theo</Th>
                <Th>Phạm vi</Th>
              </tr>
            </thead>
            <tbody>
              {vm.paginatedAhaReflections.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6">
                    <EmptyState
                      title="Chưa có Aha Moment nào khớp bộ lọc."
                      description="Thử đổi phạm vi, tổ chức hoặc từ khóa tìm kiếm."
                    />
                  </td>
                </tr>
              ) : (
                vm.paginatedAhaReflections.items.map((reflection) => (
                  <tr key={reflection.id} className="border-t border-line align-top">
                    <Td className="whitespace-nowrap text-xs text-ink-2">
                      {formatDate(reflection.createdAt)}
                    </Td>
                    <Td>
                      <div className="min-w-0 max-w-[220px]">
                        <p className="truncate font-medium text-ink" title={reflection.userName}>
                          {reflection.userName}
                        </p>
                        <p className="mt-1 truncate text-xs text-ink-3" title={reflection.userEmail || undefined}>
                          {reflection.userEmail || "Chưa có email"}
                        </p>
                      </div>
                    </Td>
                    <Td className="text-ink-2">{reflection.organizationName ?? "Cá nhân"}</Td>
                    <Td>
                      <div className="min-w-0 max-w-[220px]">
                        <p className="line-clamp-2 text-sm font-medium leading-5 text-ink" title={reflection.moduleTitle}>
                          {reflection.moduleTitle}
                        </p>
                        {reflection.moduleTitle !== reflection.moduleId ? (
                          <p className="mt-1 truncate font-mono text-[11px] text-ink-3" title={reflection.moduleId}>
                            {reflection.moduleId}
                          </p>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="max-w-[360px] whitespace-pre-wrap leading-6 text-ink">
                      {reflection.insight}
                    </Td>
                    <Td className="max-w-[260px] whitespace-pre-wrap leading-6 text-ink-2">
                      {reflection.nextAction ?? "Chưa ghi"}
                    </Td>
                    <Td>
                      <StatusBadge
                        value={reflection.visibility}
                        label={VISIBILITY_LABELS[reflection.visibility]}
                      />
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <PaginationBar
        start={vm.paginatedAhaReflections.start}
        end={vm.paginatedAhaReflections.end}
        total={vm.paginatedAhaReflections.totalItems}
        page={vm.paginatedAhaReflections.page}
        totalPages={vm.paginatedAhaReflections.totalPages}
        pageSize={vm.ahaPageSize}
        onPageChange={vm.setAhaPage}
        onPageSizeChange={vm.setAhaPageSize}
      />
    </section>
  );
}
