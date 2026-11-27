"use client";

import { Eye, Save, Search, Sparkles } from "lucide-react";
import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import {
  ClearFiltersButton,
  ListSearchField,
  ListSelectField,
  PaginationBar,
  TableInputField,
  TableSelectField,
} from "@/components/platform-admin/platform-admin-list-primitives";
import {
  EmptyState,
  PanelCard,
  Td,
  Th,
  formatDate,
  formatNumber,
} from "@/components/platform-admin/platform-admin-console-ui";
import { getPlatformAdminAiToolLabel, PLATFORM_ADMIN_AI_TOOLS } from "@/lib/platform-admin-shared";
import { useRouter } from "next/navigation";

export function OrganizationsTab({ vm }: { vm: PlatformAdminConsoleVM }) {
  const router = useRouter();
  const report = vm.report;
  if (!report) return null;

  const organizations = vm.filteredOrganizations;

  return (
    <section className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active" value={report.overview.activeOrganizations} />
        <Metric label="Suspended" value={report.overview.suspendedOrganizations} />
        <Metric label="Archived" value={report.overview.archivedOrganizations} />
        <Metric label="Invite links" value={report.overview.inviteLinks} />
      </div>

      <PanelCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ListSearchField
            label="Tìm tổ chức"
            value={vm.organizationQuery}
            onChange={vm.setOrganizationQuery}
            placeholder="Tìm công ty, slug, AI tool…"
          />
          <ListSelectField
            label="Lọc tổ chức theo trạng thái"
            value={vm.organizationStatusFilter}
            onChange={(value) =>
              vm.setOrganizationStatusFilter(value as typeof vm.organizationStatusFilter)
            }
            options={[
              { value: "all", label: "Tất cả trạng thái" },
              { value: "active", label: "Đang hoạt động" },
              { value: "suspended", label: "Tạm dừng" },
              { value: "archived", label: "Đã lưu trữ" },
            ]}
          />
          <ListSelectField
            label="Lọc tổ chức theo công cụ AI"
            value={vm.organizationToolFilter || "all"}
            onChange={(value) => vm.setOrganizationToolFilter(value === "all" ? "" : value)}
            options={[
              { value: "all", label: "Tất cả AI tool" },
              ...PLATFORM_ADMIN_AI_TOOLS.map((tool) => ({
                value: tool,
                label: getPlatformAdminAiToolLabel(tool),
              })),
            ]}
          />
          {vm.organizationQuery || vm.organizationStatusFilter !== "all" || vm.organizationToolFilter ? (
            <ClearFiltersButton
              onClick={() => {
                vm.setOrganizationQuery("");
                vm.setOrganizationStatusFilter("all");
                vm.setOrganizationToolFilter("");
              }}
            />
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {organizations.length} tổ chức hiển thị
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-2.5 py-1">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {vm.paginatedOrganizations.totalItems} kết quả
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            AI tool được chuẩn hoá theo key nội bộ
          </span>
        </div>
      </PanelCard>

      <PanelCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1160px] w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <Th>Tên công ty</Th>
                <Th>Slug</Th>
                <Th>Trạng thái</Th>
                <Th>Công cụ AI</Th>
                <Th>Thành viên</Th>
                <Th>Cập nhật</Th>
                <Th className="sticky right-0 z-20 border-l border-line bg-card shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]">
                  Hành động
                </Th>
              </tr>
            </thead>
            <tbody>
              {vm.paginatedOrganizations.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6">
                    <EmptyState
                      title="Không có tổ chức nào khớp bộ lọc."
                      description="Thử bỏ bớt điều kiện tìm kiếm hoặc đổi trạng thái."
                    />
                  </td>
                </tr>
              ) : (
                vm.paginatedOrganizations.items.map((org) => {
                  const draft = vm.drafts.orgDrafts[org.id] ?? {
                    name: org.name,
                    aiTool: org.aiTool,
                    status: org.status,
                  };
                  return (
                      <tr
                        key={org.id}
                        role="button"
                        tabIndex={0}
                        className="border-t border-line align-top hover:bg-secondary/20 cursor-pointer focus-visible:outline-none focus-visible:bg-secondary/30"
                        onClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (
                            target.closest("button") ||
                            target.closest("input") ||
                            target.closest("select") ||
                            target.closest("textarea") ||
                            target.closest("label")
                          ) {
                            return;
                          }
                          router.push(`/van-hanh/to-chuc/${org.id}`);
                        }}
                        onKeyDown={(event) => {
                          const target = event.target as HTMLElement;
                          if (
                            target.closest("button") ||
                            target.closest("input") ||
                            target.closest("select") ||
                            target.closest("textarea") ||
                            target.closest("label")
                          ) {
                            return;
                          }
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/van-hanh/to-chuc/${org.id}`);
                          }
                        }}
                      >
                      <Td>
                        <TableInputField
                          ariaLabel={`Tên công ty ${org.name}`}
                          value={draft.name}
                          onChange={(event) =>
                            vm.setDrafts((current) => ({
                              ...current,
                              orgDrafts: {
                                ...current.orgDrafts,
                                [org.id]: { ...draft, name: event.target.value },
                              },
                            }))
                          }
                          disabled={!vm.canMutate}
                          placeholder="Tên công ty"
                        />
                      </Td>
                      <Td>
                        <p className="font-mono text-xs text-ink-2">{org.slug}</p>
                      </Td>
                      <Td>
                        <TableSelectField
                          ariaLabel={`Trạng thái của ${org.name}`}
                          value={draft.status}
                          onChange={(value) =>
                            vm.confirmAction({
                              title: "Xác nhận đổi trạng thái tổ chức",
                              description: `Thao tác này sẽ cập nhật trạng thái của tổ chức "${org.name}" thành "${
                                value === "active"
                                  ? "Đang hoạt động"
                                  : value === "suspended"
                                    ? "Tạm dừng"
                                    : "Đã lưu trữ"
                              }" ngay lập tức.`,
                              confirmLabel: "Xác nhận",
                              tone: "destructive",
                              onConfirm: () =>
                                vm.runAction(`org-status:${org.id}`, "toggle-organization-status", {
                                  organizationId: org.id,
                                  status: value,
                                }),
                            })
                          }
                          options={[
                            { value: "active", label: "Đang hoạt động" },
                            { value: "suspended", label: "Tạm dừng" },
                            { value: "archived", label: "Đã lưu trữ" },
                          ]}
                          disabled={!vm.canMutate}
                        />
                      </Td>
                      <Td>
                        <TableSelectField
                          ariaLabel={`Công cụ AI của ${org.name}`}
                          value={draft.aiTool}
                          onChange={(value) =>
                            vm.setDrafts((current) => ({
                              ...current,
                              orgDrafts: {
                                ...current.orgDrafts,
                                [org.id]: {
                                  ...draft,
                                  aiTool: value,
                                },
                              },
                            }))
                          }
                          options={PLATFORM_ADMIN_AI_TOOLS.map((tool) => ({
                            value: tool,
                            label: getPlatformAdminAiToolLabel(tool),
                          }))}
                          disabled={!vm.canMutate}
                        />
                      </Td>
                      <Td className="text-ink-2">
                        <p className="font-semibold text-ink tabular-nums font-mono">{formatNumber(org.memberCount)}</p>
                        <p className="text-xs text-ink-3 tabular-nums font-mono">
                          {org.managerCount} quản lý · {org.employeeCount} nhân viên
                        </p>
                      </Td>
                      <Td className="text-ink-2">{formatDate(org.updatedAt)}</Td>
                      <Td className="sticky right-0 z-10 border-l border-line bg-card shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!vm.canMutate || vm.savingKey === `org:${org.id}`}
                            onClick={() =>
                              void vm.runAction(`org:${org.id}`, "update-organization", {
                                organizationId: org.id,
                                name: draft.name,
                                // Only send aiTool when the admin actually changed it,
                                // so an org holding a non-canonical custom tool keeps its
                                // value instead of being coerced/clobbered on an unrelated save.
                                ...(draft.aiTool !== org.aiTool ? { aiTool: draft.aiTool } : {}),
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          >
                            <Save className="h-3.5 w-3.5" aria-hidden="true" />
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/van-hanh/to-chuc/${org.id}`)}
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-secondary/40 px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            disabled={!vm.canMutate || vm.savingKey === `org-status:${org.id}`}
                            onClick={() =>
                              vm.confirmAction({
                                title: "Xác nhận đổi trạng thái tổ chức",
                                description:
                                  "Thao tác này sẽ cập nhật trạng thái tổ chức ngay lập tức và ghi audit log.",
                                confirmLabel: "Xác nhận",
                                tone: "destructive",
                                onConfirm: () =>
                                  vm.runAction(`org-status:${org.id}`, "toggle-organization-status", {
                                    organizationId: org.id,
                                    status:
                                      draft.status === "active"
                                        ? "suspended"
                                        : draft.status === "suspended"
                                          ? "active"
                                          : "archived",
                                  }),
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-secondary/40 px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          >
                            Đổi trạng thái
                          </button>
                          <button
                            type="button"
                            disabled={!vm.canMutate || vm.savingKey === `rotate:${org.id}`}
                            onClick={() =>
                              vm.confirmAction({
                                title: "Xác nhận xoay link mời",
                                description:
                                  "Link mời hiện tại của tổ chức sẽ bị thay thế. Hãy chắc chắn các bên liên quan đã được thông báo.",
                                confirmLabel: "Tạo link mới",
                                tone: "destructive",
                                onConfirm: () =>
                                  vm.runAction(`rotate:${org.id}`, "rotate-invite-link", {
                                    organizationId: org.id,
                                  }),
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-secondary/40 px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          >
                            Xoay link
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <PaginationBar
        start={vm.paginatedOrganizations.start}
        end={vm.paginatedOrganizations.end}
        total={vm.paginatedOrganizations.totalItems}
        page={vm.paginatedOrganizations.page}
        totalPages={vm.paginatedOrganizations.totalPages}
        pageSize={vm.organizationPageSize}
        onPageChange={vm.setOrganizationPage}
        onPageSizeChange={vm.setOrganizationPageSize}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
