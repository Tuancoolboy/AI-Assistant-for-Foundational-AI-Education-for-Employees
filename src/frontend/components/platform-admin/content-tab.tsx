"use client";

import { Save, Search } from "lucide-react";
import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import {
  ClearFiltersButton,
  ListSearchField,
  ListSelectField,
  PaginationBar,
  TableSelectField,
} from "@/components/platform-admin/platform-admin-list-primitives";
import { EmptyState, MetricCard, PanelCard, Td, Th } from "@/components/platform-admin/platform-admin-console-ui";
import { Workflow } from "lucide-react";

export function ContentTab({ vm }: { vm: PlatformAdminConsoleVM }) {
  const report = vm.report;
  if (!report) return null;

  return (
    <section className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {report.content.map((item) => (
          <MetricCard key={item.label} icon={Workflow} label={item.label} value={item.count} />
        ))}
      </div>

      <PanelCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ListSearchField
            label="Tìm nội dung"
            value={vm.contentQuery}
            onChange={vm.setContentQuery}
            placeholder="Tìm tiêu đề, mã, tổ chức, phạm vi"
          />
          <ListSelectField
            label="Lọc nội dung theo danh mục"
            value={vm.contentCollectionFilter}
            onChange={(value) =>
              vm.setContentCollectionFilter(value as typeof vm.contentCollectionFilter)
            }
            options={[
              { value: "all", label: "Tất cả danh mục" },
              { value: "learning_modules", label: "learning_modules" },
              { value: "training_modules", label: "training_modules" },
              { value: "learning_paths", label: "learning_paths" },
              { value: "assessments", label: "assessments" },
            ]}
          />
          <ListSelectField
            label="Lọc nội dung theo trạng thái"
            value={vm.contentStatusFilter}
            onChange={(value) => vm.setContentStatusFilter(value as typeof vm.contentStatusFilter)}
            options={[
              { value: "all", label: "Tất cả trạng thái" },
              { value: "draft", label: "Bản nháp" },
              { value: "published", label: "Đã xuất bản" },
              { value: "archived", label: "Đã lưu trữ" },
            ]}
          />
          {vm.contentQuery || vm.contentCollectionFilter !== "all" || vm.contentStatusFilter !== "all" ? (
            <ClearFiltersButton
              onClick={() => {
                vm.setContentQuery("");
                vm.setContentCollectionFilter("all");
                vm.setContentStatusFilter("all");
              }}
            />
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-2.5 py-1">
            <Search className="h-3.5 w-3.5" />
            {vm.paginatedContentItems.totalItems} kết quả
          </span>
        </div>
      </PanelCard>

      <PanelCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <Th>Danh mục</Th>
                <Th>Tiêu đề</Th>
                <Th>Trạng thái</Th>
                <Th>Phạm vi</Th>
                <Th>Tổ chức</Th>
                <Th>Phiên bản</Th>
                <Th>Cập nhật</Th>
                <Th className="sticky right-0 z-20 border-l border-line bg-card shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]">
                  Hành động
                </Th>
              </tr>
            </thead>
            <tbody>
              {vm.paginatedContentItems.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6">
                    <EmptyState
                      title="Không có nội dung nào khớp bộ lọc."
                      description="Thử đổi danh mục hoặc trạng thái để xem thêm dữ liệu."
                    />
                  </td>
                </tr>
              ) : (
                vm.paginatedContentItems.items.map((item) => {
                  const key = `${item.collection}:${item.id}`;
                  const draft = vm.drafts.contentDrafts[key] ?? { status: item.status };
                  return (
                    <tr key={key} className="border-t border-line align-top">
                      <Td className="font-mono text-xs text-ink-2">{item.collection}</Td>
                      <Td>
                        <div className="space-y-1">
                          <p className="font-medium text-ink">{item.title}</p>
                          <p className="text-xs text-ink-3">{item.id}</p>
                        </div>
                      </Td>
                      <Td>
                        <TableSelectField
                          ariaLabel={`Trạng thái của ${item.title}`}
                          value={draft.status}
                          onChange={(value) =>
                            vm.setDrafts((current) => ({
                              ...current,
                              contentDrafts: {
                                ...current.contentDrafts,
                                [key]: {
                                  ...draft,
                                  status: value as typeof draft.status,
                                },
                              },
                            }))
                          }
                          options={[
                            { value: "draft", label: "Bản nháp" },
                            { value: "published", label: "Đã xuất bản" },
                            { value: "archived", label: "Đã lưu trữ" },
                          ]}
                          disabled={!vm.canMutate}
                        />
                      </Td>
                      <Td className="text-ink-2">{item.scope ?? "—"}</Td>
                      <Td className="text-ink-2">{item.organizationName ?? "—"}</Td>
                      <Td className="text-ink-2">{item.version ?? "—"}</Td>
                      <Td className="text-ink-2">
                        {item.updatedAt
                          ? new Intl.DateTimeFormat("vi-VN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(item.updatedAt))
                          : "Chưa có"}
                      </Td>
                      <Td>
                        <button
                          type="button"
                          disabled={!vm.canMutate || vm.savingKey === `content:${key}`}
                          onClick={() =>
                            void vm.runAction(`content:${key}`, "set-content-status", {
                              collection: item.collection,
                              id: item.id,
                              status: draft.status,
                            })
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Lưu
                        </button>
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
        start={vm.paginatedContentItems.start}
        end={vm.paginatedContentItems.end}
        total={vm.paginatedContentItems.totalItems}
        page={vm.paginatedContentItems.page}
        totalPages={vm.paginatedContentItems.totalPages}
        pageSize={vm.contentPageSize}
        onPageChange={vm.setContentPage}
        onPageSizeChange={vm.setContentPageSize}
      />
    </section>
  );
}
