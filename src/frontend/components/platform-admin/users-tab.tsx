"use client";

import {
  Archive,
  Eye,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import {
  BulkActionBar,
  ClearFiltersButton,
  ListSearchField,
  ListSelectField,
  PaginationBar,
  StatusBadge,
  TableInputField,
  TableSelectField,
} from "@/components/platform-admin/platform-admin-list-primitives";
import {
  EmptyState,
  PanelCard,
  Td,
  Th,
  formatDate,
} from "@/components/platform-admin/platform-admin-console-ui";
import { UserDetailDrawer } from "@/components/platform-admin/user-detail-drawer";

const WORK_ROLE_OPTIONS = [
  { value: "kinh-doanh", label: "Kinh doanh" },
  { value: "ke-toan", label: "Kế toán" },
  { value: "marketing", label: "Marketing" },
  { value: "van-hanh", label: "Vận hành" },
  { value: "nhan-su", label: "Nhân sự" },
  { value: "khac", label: "Khác (Văn phòng)" },
] as const;

const AI_LEVEL_OPTIONS = Array.from({ length: 6 }, (_, level) => ({
  value: String(level),
  label: `Mức ${level}`,
}));

export function UsersTab({ vm }: { vm: PlatformAdminConsoleVM }) {
  const report = vm.report;
  if (!report) return null;

  const visibleUserIds = vm.paginatedUsers.items.map((user) => user.id);
  const selectedUserSet = new Set(vm.selectedUserIds);
  const allVisibleSelected =
    visibleUserIds.length > 0 &&
    visibleUserIds.every((userId) => selectedUserSet.has(userId));
  // Bulk delete only acts on selections that match the CURRENT filter. Selection
  // persists across filter changes, so without this a stale pick from a previous
  // filter could delete users not currently visible. filteredUsers spans all
  // pages, so cross-page selection within the same filter still works.
  const filteredUserIdSet = new Set(vm.filteredUsers.map((user) => user.id));
  const selectedInFilterIds = vm.selectedUserIds.filter((userId) =>
    filteredUserIdSet.has(userId),
  );
  const deletableSelectedIds = selectedInFilterIds.filter((userId) => {
    const user = report.users.find((item) => item.id === userId);
    return user ? !user.platformAdmin : false;
  });
  const selectedUser = vm.selectedUserId
    ? report.users.find((user) => user.id === vm.selectedUserId) ?? null
    : null;

  return (
    <section className="mt-6 space-y-4">
      <PanelCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ListSearchField
            label="Tìm người dùng"
            value={vm.userQuery}
            onChange={vm.setUserQuery}
            placeholder="Tìm tên, email, phòng ban, số điện thoại…"
          />
          <ListSelectField
            label="Lọc người dùng theo vai trò"
            value={vm.userRoleFilter}
            onChange={(value) => vm.setUserRoleFilter(value as typeof vm.userRoleFilter)}
            options={[
              { value: "all", label: "Tất cả vai trò" },
              { value: "platform-admin", label: "Quản trị hệ thống" },
              { value: "manager", label: "Quản lý" },
              { value: "employee", label: "Nhân viên" },
            ]}
          />
          <ListSelectField
            label="Lọc người dùng theo loại tài khoản"
            value={vm.userAccountFilter}
            onChange={(value) => vm.setUserAccountFilter(value as typeof vm.userAccountFilter)}
            options={[
              { value: "all", label: "Tất cả loại tài khoản" },
              { value: "company", label: "Công ty" },
              { value: "individual", label: "Cá nhân" },
            ]}
          />
          <ListSelectField
            label="Lọc người dùng theo trạng thái kích hoạt"
            value={vm.userActivationFilter}
            onChange={(value) => vm.setUserActivationFilter(value as typeof vm.userActivationFilter)}
            options={[
              { value: "all", label: "Tất cả trạng thái" },
              { value: "activated", label: "Đã kích hoạt" },
              { value: "pending", label: "Chờ kích hoạt" },
            ]}
          />
          {vm.userQuery || vm.userRoleFilter !== "all" || vm.userAccountFilter !== "all" || vm.userActivationFilter !== "all" ? (
            <ClearFiltersButton
              onClick={() => {
                vm.setUserQuery("");
                vm.setUserRoleFilter("all");
                vm.setUserAccountFilter("all");
                vm.setUserActivationFilter("all");
              }}
            />
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-2.5 py-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {vm.paginatedUsers.totalItems} kết quả
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-2.5 py-1">
            <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {vm.selectedUserIds.length} đã chọn
          </span>
        </div>
      </PanelCard>

      <BulkActionBar count={vm.selectedUserIds.length}>
        <button
          type="button"
          onClick={() => vm.setSelectedUserIds([])}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Bỏ chọn
        </button>
        <button
          type="button"
          disabled={!vm.canMutate || deletableSelectedIds.length === 0}
          onClick={() =>
            vm.confirmAction({
              title: "Xoá tài khoản đã chọn",
              description: `Xác nhận xoá ${deletableSelectedIds.length} tài khoản đã chọn (khớp bộ lọc hiện tại)? Các tài khoản super-admin sẽ được bỏ qua trừ khi xoá từng người trong detail drawer.`,
              confirmLabel: "Xoá tài khoản",
              tone: "destructive",
              onConfirm: () =>
                vm.runAction("bulk-delete-users", "delete-users", {
                  userIds: selectedInFilterIds,
                  confirmUserCount: deletableSelectedIds.length,
                  excludePlatformAdmins: true,
                }),
            })
          }
          className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive hover:border-destructive/40 disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          Xoá đã chọn
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold">
            {deletableSelectedIds.length}
          </span>
        </button>
      </BulkActionBar>

      <PanelCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <Th>
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả người dùng đang hiển thị"
                    checked={allVisibleSelected}
                    onChange={(event) =>
                      vm.setSelectedUserIds(
                        event.target.checked
                          ? Array.from(new Set([...vm.selectedUserIds, ...visibleUserIds]))
                          : vm.selectedUserIds.filter((userId) => !visibleUserIds.includes(userId)),
                      )
                    }
                    disabled={!vm.canMutate || visibleUserIds.length === 0}
                    className="h-4 w-4 rounded border-line text-brand focus:ring-brand disabled:opacity-60"
                  />
                </Th>
                <Th>Họ tên</Th>
                <Th>Email</Th>
                <Th>Loại</Th>
                <Th>Tổ chức</Th>
                <Th>Trình độ AI</Th>
                <Th>Kích hoạt</Th>
                <Th>Vai trò</Th>
                <Th>SĐT</Th>
                <Th>Quyền</Th>
                <Th>Hoạt động</Th>
                <Th className="sticky right-0 z-20 border-l border-line bg-card shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]">
                  Hành động
                </Th>
              </tr>
            </thead>
            <tbody>
              {vm.paginatedUsers.items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-6">
                    <EmptyState
                      title="Không có user nào khớp bộ lọc."
                      description="Thử xóa bớt điều kiện tìm kiếm để mở rộng tập kết quả."
                    />
                  </td>
                </tr>
              ) : (
                vm.paginatedUsers.items.map((user) => {
                  const draft = vm.drafts.userDrafts[user.id] ?? {
                    fullName: user.fullName,
                    phoneNumber: user.phoneNumber ?? "",
                    roleId: user.roleId ?? "",
                    aiLevel: user.aiLevel ?? 0,
                    accountType: user.accountType,
                    organizationId: user.organizationId ?? "",
                    memberRole: user.memberRole ?? "",
                    departmentId: user.departmentId ?? "",
                    platformAdmin: user.platformAdmin,
                  };
                  const isSelected = selectedUserSet.has(user.id);
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        "transition-colors border-b border-line/60 hover:bg-secondary/15",
                        isSelected && "bg-brand-soft/30 hover:bg-brand-soft/45"
                      )}
                    >
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Chọn người dùng ${user.email}`}
                          checked={isSelected}
                          onChange={(event) =>
                            vm.setSelectedUserIds(
                              event.target.checked
                                ? Array.from(new Set([...vm.selectedUserIds, user.id]))
                                : vm.selectedUserIds.filter((id) => id !== user.id),
                            )
                          }
                          disabled={!vm.canMutate}
                          className="h-4 w-4 rounded border-line text-brand focus:ring-brand disabled:opacity-60"
                        />
                      </Td>
                      <Td>
                        <TableInputField
                          ariaLabel={`Họ tên của ${user.email}`}
                          value={draft.fullName}
                          onChange={(event) =>
                            vm.setDrafts((current) => ({
                              ...current,
                              userDrafts: {
                                ...current.userDrafts,
                                [user.id]: { ...draft, fullName: event.target.value },
                              },
                            }))
                          }
                          disabled={!vm.canMutate}
                          placeholder="Chưa nhập họ tên"
                        />
                      </Td>
                      <Td className="text-ink-2 font-mono text-xs">{user.email}</Td>
                      <Td>
                        <TableSelectField
                          ariaLabel={`Loại tài khoản của ${user.email}`}
                          value={draft.accountType}
                          onChange={(value) =>
                            vm.setDrafts((current) => ({
                              ...current,
                              userDrafts: {
                                ...current.userDrafts,
                                [user.id]: {
                                  ...draft,
                                  accountType: value as typeof draft.accountType,
                                },
                              },
                            }))
                          }
                          options={[
                            { value: "company", label: "Doanh nghiệp" },
                            { value: "individual", label: "Cá nhân" },
                          ]}
                          disabled={!vm.canMutate}
                        />
                      </Td>
                      <Td className="text-ink-2 font-medium">{user.organizationName ?? "—"}</Td>
                      <Td>
                        <TableSelectField
                          ariaLabel={`Trình độ AI của ${user.email}`}
                          value={String(draft.aiLevel)}
                          onChange={(value) =>
                            vm.setDrafts((current) => ({
                              ...current,
                              userDrafts: {
                                ...current.userDrafts,
                                [user.id]: {
                                  ...draft,
                                  aiLevel: Number(value),
                                },
                              },
                            }))
                          }
                          options={AI_LEVEL_OPTIONS}
                          disabled={!vm.canMutate}
                        />
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge
                            value={user.learningActivated ? "activated" : "pending"}
                            label={user.learningActivated ? "Đã kích hoạt" : "Chờ kích hoạt"}
                          />
                          {user.learningActivated && user.learningActivatedAt && (
                            <span className="text-[10px] text-ink-3 tabular-nums font-mono">
                              {formatDate(user.learningActivatedAt)}
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <div className="space-y-1.5 py-1">
                          <TableSelectField
                            ariaLabel={`Vai trò công việc của ${user.email}`}
                            value={draft.roleId}
                            onChange={(value) =>
                              vm.setDrafts((current) => ({
                                ...current,
                                userDrafts: {
                                  ...current.userDrafts,
                                  [user.id]: {
                                    ...draft,
                                    roleId: value,
                                  },
                                },
                              }))
                            }
                            options={[
                              { value: "", label: "— Công việc —" },
                              ...WORK_ROLE_OPTIONS.map((option) => ({
                                value: option.value,
                                label: option.label,
                              })),
                            ]}
                            disabled={!vm.canMutate}
                          />
                          <TableSelectField
                            ariaLabel={`Vai trò tổ chức của ${user.email}`}
                            value={draft.memberRole}
                            onChange={(value) =>
                              vm.setDrafts((current) => ({
                                ...current,
                                userDrafts: {
                                  ...current.userDrafts,
                                  [user.id]: {
                                    ...draft,
                                    memberRole: value as typeof draft.memberRole,
                                  },
                                },
                              }))
                            }
                            options={[
                              { value: "", label: "— Tổ chức —" },
                              { value: "owner", label: "Owner" },
                              { value: "manager", label: "Manager" },
                              { value: "employee", label: "Employee" },
                            ]}
                            disabled={!vm.canMutate}
                          />
                        </div>
                      </Td>
                      <Td>
                        <TableInputField
                          ariaLabel={`Số điện thoại của ${user.email}`}
                          value={draft.phoneNumber}
                          onChange={(event) =>
                            vm.setDrafts((current) => ({
                              ...current,
                              userDrafts: {
                                ...current.userDrafts,
                                [user.id]: { ...draft, phoneNumber: event.target.value },
                              },
                            }))
                          }
                          disabled={!vm.canMutate}
                          placeholder="Chưa cập nhật"
                        />
                      </Td>
                      <Td>
                        <TableSelectField
                          ariaLabel={`Quyền hệ thống của ${user.email}`}
                          value={draft.platformAdmin ? "true" : "false"}
                          onChange={(value) =>
                            vm.setDrafts((current) => ({
                              ...current,
                              userDrafts: {
                                ...current.userDrafts,
                                [user.id]: {
                                  ...draft,
                                  platformAdmin: value === "true",
                                },
                              },
                            }))
                          }
                          options={[
                            { value: "false", label: "Học viên" },
                            { value: "true", label: "Admin hệ thống" },
                          ]}
                          disabled={!vm.canMutate}
                        />
                      </Td>
                      <Td className="text-xs text-ink-2 whitespace-nowrap tabular-nums font-mono">
                        <div>Hoạt động: {formatDate(user.lastActivityAt)}</div>
                        <div className="text-[10px] text-ink-3">Tạo lúc: {formatDate(user.createdAt)}</div>
                      </Td>
                      <Td className="sticky right-0 z-10 border-l border-line bg-card shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!vm.canMutate || vm.savingKey === `user:${user.id}`}
                            onClick={() =>
                              void vm.runAction(`user:${user.id}`, "update-user", {
                                userId: user.id,
                                fullName: draft.fullName,
                                phoneNumber: draft.phoneNumber || null,
                                roleId: draft.roleId || null,
                                aiLevel: draft.aiLevel,
                                accountType: draft.accountType,
                                organizationId: draft.organizationId || user.organizationId,
                                memberRole: draft.memberRole || null,
                                departmentId: draft.departmentId || null,
                                platformAdmin: draft.platformAdmin,
                                email: user.email,
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          >
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => vm.openUserDetail(user.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-secondary/40 px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            disabled={!vm.canMutate || vm.savingKey === `delete:${user.id}`}
                            onClick={() =>
                              vm.confirmAction({
                                title: "Xoá tài khoản",
                                description:
                                  "Tài khoản Supabase Auth và dữ liệu người dùng sẽ bị xoá khỏi hệ thống. Hành động này không thể hoàn tác.",
                                confirmLabel: "Xoá tài khoản",
                                tone: "destructive",
                                onConfirm: () =>
                                  vm.runAction(`delete:${user.id}`, "delete-users", {
                                    userIds: [user.id],
                                    confirmUserCount: 1,
                                    excludePlatformAdmins: false,
                                  }),
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive transition hover:border-destructive/40 disabled:opacity-60"
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            Xoá
                          </button>
                          <button
                            type="button"
                            disabled={!vm.canMutate || vm.savingKey === `activation:${user.id}`}
                            onClick={() =>
                              vm.confirmAction({
                                title: user.learningActivated
                                  ? "Huỷ kích hoạt tài khoản"
                                  : "Kích hoạt tài khoản học viên",
                                description: user.learningActivated
                                  ? "Tài khoản sẽ trở về trạng thái chờ kích hoạt và không còn vào được lộ trình học."
                                  : "Khi kích hoạt, hệ thống sẽ mở quyền học và gửi email thông báo cho nhân viên.",
                                confirmLabel: user.learningActivated ? "Huỷ kích hoạt" : "Kích hoạt",
                                tone: user.learningActivated ? "destructive" : "default",
                                onConfirm: () =>
                                  vm.runAction(`activation:${user.id}`, "set-user-activation", {
                                    userId: user.id,
                                    activated: !user.learningActivated,
                                  }),
                              })
                            }
                            className={[
                              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-60",
                              user.learningActivated
                                ? "border-destructive/20 bg-destructive/5 text-destructive hover:border-destructive/40"
                                : "border-brand/20 bg-brand-soft text-brand hover:border-brand",
                            ].join(" ")}
                            >
                            {user.learningActivated ? "Huỷ kích hoạt" : "Kích hoạt"}
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
        start={vm.paginatedUsers.start}
        end={vm.paginatedUsers.end}
        total={vm.paginatedUsers.totalItems}
        page={vm.paginatedUsers.page}
        totalPages={vm.paginatedUsers.totalPages}
        pageSize={vm.userPageSize}
        onPageChange={vm.setUserPage}
        onPageSizeChange={vm.setUserPageSize}
      />

      <UserDetailDrawer vm={vm} user={selectedUser} />
    </section>
  );
}
