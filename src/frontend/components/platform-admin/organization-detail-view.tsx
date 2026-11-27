"use client";

import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Building2,
  Check,
  GraduationCap,
  Hash,
  Layers3,
  ShieldCheck,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/platform-admin/platform-admin-list-primitives";
import { Td, Th, formatDate } from "@/components/platform-admin/platform-admin-console-ui";
import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import type {
  PlatformAdminOrgAdminPermissions,
  PlatformAdminOrganizationDetailRow,
  PlatformAdminOrganizationRow,
} from "@/lib/platform-admin-types";
import { getPlatformAdminAiToolLabel } from "@/lib/platform-admin-shared";
import { cn } from "@/lib/utils";

const PERMISSION_TITLES: Record<
  keyof PlatformAdminOrgAdminPermissions,
  { label: string; description: string }
> = {
  members: {
    label: "Thành viên",
    description: "Xem và quản lý danh sách nhân viên của tổ chức.",
  },
  learning: {
    label: "Học tập",
    description: "Xem lộ trình, tiến độ, quiz và hoạt động học.",
  },
  content: {
    label: "Nội dung",
    description: "Theo dõi module, path và cấu hình nội dung nội bộ.",
  },
  analytics: {
    label: "Phân tích",
    description: "Xem số liệu tổng hợp, giờ tiết kiệm và trạng thái học.",
  },
  invite_links: {
    label: "Link mời",
    description: "Tạo hoặc xoay link mời cho tổ chức.",
  },
  accounts: {
    label: "Tài khoản admin",
    description: "Tạo và sửa quyền cho admin tổ chức.",
  },
};

type AdminFormState = {
  email: string;
  fullName: string;
  role: "super_admin" | "admin";
  departmentId: string;
  permissions: PlatformAdminOrgAdminPermissions;
};

function createDefaultPermissions(role: AdminFormState["role"]): PlatformAdminOrgAdminPermissions {
  return {
    members: true,
    learning: role === "super_admin",
    content: role === "super_admin",
    analytics: true,
    invite_links: role === "super_admin",
    accounts: role === "super_admin",
  };
}

function createDefaultForm(): AdminFormState {
  return {
    email: "",
    fullName: "",
    role: "admin",
    departmentId: "nhan-su",
    permissions: createDefaultPermissions("admin"),
  };
}

export function OrganizationDetailView({
  vm,
  organization,
}: {
  vm: PlatformAdminConsoleVM;
  organization: PlatformAdminOrganizationRow;
}) {
  const [tab, setTab] = useState<"overview" | "members" | "accounts">("overview");

  const detail: PlatformAdminOrganizationDetailRow | null =
    vm.report?.organizationDetails[organization.id] ?? null;
  const members = detail?.members ?? [];
  const admins = detail?.admins ?? [];

  const metrics = useMemo(
    () => [
      { label: "Thành viên", value: detail?.memberCount ?? organization?.memberCount ?? 0 },
      { label: "Quản lý", value: detail?.managerCount ?? organization?.managerCount ?? 0 },
      { label: "Nhân viên", value: detail?.employeeCount ?? organization?.employeeCount ?? 0 },
      { label: "Học đang hoạt động", value: detail?.activeLearnerCount ?? 0 },
    ],
    [detail, organization],
  );

  const learningMetrics = useMemo(
    () => [
      { label: "Kích hoạt học", value: detail?.learningActivatedCount ?? 0 },
      { label: "Quiz", value: detail?.quizCount ?? 0 },
      { label: "Điểm quiz TB", value: detail?.averageQuizScore ?? 0 },
      { label: "Giờ tiết kiệm", value: detail?.totalHoursSaved ?? 0 },
      { label: "AI level TB", value: detail?.averageAiLevel ?? 0 },
      { label: "Bài gán", value: detail?.assignments ?? 0 },
    ],
    [detail],
  );

  return (
    <div className="rounded-2xl border border-line bg-card shadow-sm">
      <div className="border-b border-line px-6 py-5">
        <h1 className="font-display text-2xl font-bold text-ink">{organization.name}</h1>
        <p className="mt-1 text-sm text-ink-2">Slug: {organization.slug}</p>
        
        <div className="mt-6 flex flex-wrap gap-2">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>Tổng quan</TabButton>
          <TabButton active={tab === "members"} onClick={() => setTab("members")}>Nhân sự</TabButton>
          <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")}>Tạo tài khoản</TabButton>
        </div>
      </div>

      <div className="p-6">
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard icon={Building2} label="Tên công ty" value={organization.name} />
              <InfoCard icon={Hash} label="Slug" value={organization.slug} />
              <InfoCard icon={Layers3} label="Công cụ AI" value={getPlatformAdminAiToolLabel(organization.aiTool)} />
              <InfoCard icon={Users} label="Admin / nhân sự" value={`${detail?.managerCount ?? organization.managerCount} / ${detail?.employeeCount ?? organization.employeeCount}`} />
            </div>

            <section className="rounded-2xl border border-line bg-secondary/10 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  value={organization.status}
                  label={
                    organization.status === "active"
                      ? "Đang hoạt động"
                      : organization.status === "suspended"
                        ? "Tạm dừng"
                        : "Đã lưu trữ"
                  }
                />
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-ink-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {admins.length} tài khoản admin
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-ink-2">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {detail?.activeLearnerCount ?? 0} người đang học
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <InfoLine key={metric.label} label={metric.label} value={`${metric.value}`} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Mức học tập</h3>
                  <p className="mt-1 text-sm text-ink-2">Tóm tắt tiến độ học của tổ chức đang được chuẩn hoá.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {learningMetrics.map((metric) => (
                  <InfoLine key={metric.label} label={metric.label} value={`${metric.value}`} />
                ))}
              </div>
              {detail?.lastActivityAt ? (
                <p className="mt-4 text-xs text-ink-3">
                  Hoạt động gần nhất: <span className="font-semibold text-ink">{formatDate(detail.lastActivityAt)}</span>
                </p>
              ) : null}
            </section>
          </div>
        )}

        {tab === "members" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Thành viên</h3>
                <p className="mt-1 text-sm text-ink-2">Danh sách nhân sự thuộc tổ chức này.</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-3 py-1 text-xs font-semibold text-ink-2">
                {members.length} người
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-ink-3">
                  <tr>
                    <Th>Họ tên</Th>
                    <Th>Email</Th>
                    <Th>Vai trò</Th>
                    <Th>Học</Th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6">
                        <p className="text-sm text-ink-2">Chưa có thành viên nào trong tổ chức này.</p>
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.userId} className="border-t border-line align-top">
                        <Td className="font-medium text-ink">{member.fullName}</Td>
                        <Td className="text-ink-2">{member.email}</Td>
                        <Td>
                          <StatusBadge
                            value={
                              member.memberRole === "owner"
                                ? "super-admin"
                                : member.memberRole === "manager"
                                  ? "manager"
                                  : "employee"
                            }
                            label={
                              member.memberRole === "owner"
                                ? "super_admin"
                                : member.memberRole === "manager"
                                  ? "admin"
                                  : "employee"
                            }
                          />
                          {member.departmentId ? (
                            <p className="mt-1 text-xs text-ink-3">{member.departmentId}</p>
                          ) : null}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-1 font-semibold",
                                member.learningActivated
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-100 text-slate-700",
                              )}
                            >
                              {member.learningActivated ? "Đã bật học" : "Chưa bật học"}
                            </span>
                            <span className="rounded-full border border-line bg-secondary/20 px-2 py-1 font-semibold">
                              AI {member.aiLevel ?? 0}
                            </span>
                          </div>
                          {member.lastActivityAt ? (
                            <p className="mt-1 text-xs text-ink-3">
                              {formatDate(member.lastActivityAt)}
                            </p>
                          ) : null}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "accounts" && (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Tài khoản admin hiện có</h3>
                  <p className="mt-1 text-sm text-ink-2">Dữ liệu này được lưu đồng nhất trong settings tổ chức.</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-secondary/30 px-3 py-1 text-xs font-semibold text-ink-2">
                  {admins.length} admin
                </span>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {admins.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line bg-secondary/20 p-4 text-sm text-ink-2 xl:col-span-2">
                    Chưa có admin nào được tạo từ console này.
                  </div>
                ) : (
                  admins.map((admin) => (
                    <div key={`${admin.userId}:${admin.email}`} className="rounded-2xl border border-line bg-secondary/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-ink">{admin.fullName}</p>
                          <p className="text-sm text-ink-2">{admin.email}</p>
                        </div>
                        <StatusBadge
                          value={admin.role === "super_admin" ? "super-admin" : "manager"}
                          label={admin.role === "super_admin" ? "super_admin" : "admin"}
                        />
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {Object.entries(admin.permissions).map(([key, enabled]) => (
                          <div
                            key={key}
                            className={cn(
                              "flex items-center justify-between rounded-xl border px-3 py-2 text-xs",
                              enabled
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-line bg-card text-ink-3",
                            )}
                          >
                            <span>{PERMISSION_TITLES[key as keyof PlatformAdminOrgAdminPermissions].label}</span>
                            {enabled ? <Check className="h-3.5 w-3.5" /> : <span>—</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-brand/20 bg-brand-soft/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-brand">Tạo tài khoản admin tổ chức</h3>
                  <p className="mt-1 text-sm text-brand/80">Tạo trực tiếp từ console để đồng nhất dữ liệu và quyền truy cập.</p>
                </div>
              </div>
              <CreateAdminForm key={organization.id} vm={vm} organization={organization} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active ? "bg-brand text-brand-foreground" : "bg-secondary/40 text-ink-2 hover:bg-secondary hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-secondary/10 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className="mt-1 break-words text-sm text-ink">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function RolePill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-4 text-xs font-semibold uppercase tracking-wide transition",
        active
          ? "border-brand/20 bg-brand-soft text-brand"
          : "border-line bg-card text-ink-2 hover:border-brand hover:text-brand",
      )}
    >
      {label}
    </button>
  );
}

function CreateAdminForm({
  vm,
  organization,
}: {
  vm: PlatformAdminConsoleVM;
  organization: PlatformAdminOrganizationRow;
}) {
  const [form, setForm] = useState<AdminFormState>(() => createDefaultForm());

  function updatePermission(key: keyof PlatformAdminOrgAdminPermissions, checked: boolean) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: checked,
      },
    }));
  }

  function handleRoleChange(nextRole: AdminFormState["role"]) {
    setForm((current) => ({
      ...current,
      role: nextRole,
      permissions: createDefaultPermissions(nextRole),
    }));
  }

  function buildCreatePayload() {
    return {
      organizationId: organization.id,
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      adminRole: form.role,
      departmentId: form.departmentId.trim() || "nhan-su",
      permissions: form.permissions,
    };
  }

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = buildCreatePayload();
        if (!payload.email || !payload.fullName) {
          vm.confirmAction({
            title: "Thiếu thông tin tạo admin",
            description:
              "Cần nhập email và họ tên trước khi tạo tài khoản tổ chức.",
            confirmLabel: "Đóng",
            onConfirm: () => undefined,
          });
          return;
        }

        vm.confirmAction({
          title: "Xác nhận tạo tài khoản admin",
          description:
            "Tài khoản auth, profile, membership và quyền tổ chức sẽ được tạo/cập nhật ngay. Nếu là user mới, hệ thống sẽ gửi email đặt mật khẩu thay vì nhận mật khẩu qua biểu mẫu này.",
          confirmLabel: "Tạo tài khoản",
          tone: "destructive",
          onConfirm: async () => {
            await vm.runAction(
              `create-org-admin:${organization.id}`,
              "create-organization-admin",
              payload,
            );
            setForm(createDefaultForm());
          },
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Email">
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            placeholder="admin@doanhnghiep.vn"
          />
        </Field>
        <Field label="Họ tên">
          <input
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({ ...current, fullName: event.target.value }))
            }
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            placeholder="Nguyễn Văn A"
          />
        </Field>
        <Field label="Phòng ban">
          <input
            value={form.departmentId}
            onChange={(event) =>
              setForm((current) => ({ ...current, departmentId: event.target.value }))
            }
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            placeholder="nhan-su"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <RolePill
          active={form.role === "admin"}
          label="admin"
          onClick={() => handleRoleChange("admin")}
        />
        <RolePill
          active={form.role === "super_admin"}
          label="super_admin"
          onClick={() => handleRoleChange("super_admin")}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(PERMISSION_TITLES).map(([key, meta]) => (
          <label
            key={key}
            className="flex items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3"
          >
            <input
              type="checkbox"
              checked={form.permissions[key as keyof PlatformAdminOrgAdminPermissions]}
              onChange={(event) =>
                updatePermission(key as keyof PlatformAdminOrgAdminPermissions, event.target.checked)
              }
              className="mt-1 h-4 w-4 rounded border-line text-brand focus:ring-brand"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{meta.label}</span>
              <span className="mt-0.5 block text-xs text-ink-3">{meta.description}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!vm.canMutate || vm.savingKey === `create-org-admin:${organization.id}`}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-2 disabled:opacity-60"
        >
          <ShieldCheck className="h-4 w-4" />
          Tạo admin
        </button>
      </div>
    </form>
  );
}
