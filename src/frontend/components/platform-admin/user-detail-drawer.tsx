"use client";

import { useEffect, useState } from "react";

import { Drawer } from "@base-ui/react/drawer";
import type { ComponentType, ReactNode } from "react";
import {
  Archive,
  Building2,
  CalendarClock,
  Clock3,
  KeyRound,
  Mail,
  Phone,
  Shield,
  Sparkles,
  UserCircle2,
  X,
  Activity,
  CheckCircle2,
  PlayCircle,
  HelpCircle,
  Timer,
} from "lucide-react";
import { StatusBadge } from "@/components/platform-admin/platform-admin-list-primitives";
import type { PlatformAdminConsoleVM } from "@/hooks/use-platform-admin-console";
import type { PlatformAdminUserRow } from "@/lib/platform-admin-types";
import { cn } from "@/lib/utils";

export function UserDetailDrawer({
  vm,
  user,
}: {
  vm: PlatformAdminConsoleVM;
  user: PlatformAdminUserRow | null;
}) {
  const draft = user ? vm.drafts.userDrafts[user.id] ?? null : null;
  const open = Boolean(user);

  return (
    <Drawer.Root open={open} onOpenChange={(nextOpen) => !nextOpen && vm.closeUserDetail()}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[1px]" />
        <Drawer.Popup
          initialFocus={false}
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-[min(94vw,42rem)] flex-col border-l border-line bg-card shadow-2xl outline-none",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Chi tiết người dùng</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{user?.fullName ?? "Người dùng"}</h2>
              <p className="mt-1 text-sm text-ink-2">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={vm.closeUserDetail}
              className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-secondary/40 px-3 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand"
              aria-label="Đóng detail user"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {user ? (
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetaCard icon={Mail} label="Email" value={user.email} />
                <MetaCard icon={UserCircle2} label="Họ tên" value={user.fullName || "—"} />
                <MetaCard
                  icon={Building2}
                  label="Tổ chức"
                  value={user.organizationName ?? "—"}
                />
                <MetaCard
                  icon={Sparkles}
                  label="Mức AI"
                  value={String(user.aiLevel ?? 0)}
                />
              </div>

              <section className="mt-5 rounded-2xl border border-line bg-secondary/10 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    value={user.learningActivated ? "activated" : "pending"}
                    label={user.learningActivated ? "Đã kích hoạt" : "Chờ kích hoạt"}
                  />
                  <StatusBadge
                    value={user.accountType}
                    label={user.accountType === "company" ? "Công ty" : "Cá nhân"}
                  />
                  {user.platformAdmin ? (
                    <StatusBadge value="active" label="Quản trị hệ thống" />
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoLine icon={Shield} label="Vai trò hệ thống" value={user.roleId ?? "—"} />
                  <InfoLine icon={KeyRound} label="Quyền tổ chức" value={user.memberRole ?? "—"} />
                  <InfoLine icon={Phone} label="SĐT" value={user.phoneNumber ?? "—"} />
                  <InfoLine
                    icon={CalendarClock}
                    label="Kích hoạt lúc"
                    value={user.learningActivatedAt ?? "—"}
                  />
                  <InfoLine
                    icon={Clock3}
                    label="Lần hoạt động gần nhất"
                    value={user.lastActivityAt ?? "—"}
                  />
                  <InfoLine
                    icon={Archive}
                    label="Tạo lúc"
                    value={user.createdAt ?? "—"}
                  />
                </div>
              </section>

              <section className="mt-5 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Chỉnh sửa nhanh</h3>
                <div className="grid gap-3">
                  <EditableLine label="Họ tên">
                    <input
                      value={draft?.fullName ?? user.fullName}
                      onChange={(event) =>
                        vm.setDrafts((current) => ({
                          ...current,
                          userDrafts: {
                            ...current.userDrafts,
                            [user.id]: {
                              ...(draft ?? {
                                fullName: user.fullName,
                                phoneNumber: user.phoneNumber ?? "",
                                roleId: user.roleId ?? "",
                                aiLevel: user.aiLevel ?? 0,
                                accountType: user.accountType,
                                organizationId: user.organizationId ?? "",
                                memberRole: user.memberRole ?? "",
                                departmentId: user.departmentId ?? "",
                                platformAdmin: user.platformAdmin,
                              }),
                              fullName: event.target.value,
                            },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </EditableLine>
                  <EditableLine label="SĐT">
                    <input
                      value={draft?.phoneNumber ?? user.phoneNumber ?? ""}
                      onChange={(event) =>
                        vm.setDrafts((current) => ({
                          ...current,
                          userDrafts: {
                            ...current.userDrafts,
                            [user.id]: {
                              ...(draft ?? {
                                fullName: user.fullName,
                                phoneNumber: user.phoneNumber ?? "",
                                roleId: user.roleId ?? "",
                                aiLevel: user.aiLevel ?? 0,
                                accountType: user.accountType,
                                organizationId: user.organizationId ?? "",
                                memberRole: user.memberRole ?? "",
                                departmentId: user.departmentId ?? "",
                                platformAdmin: user.platformAdmin,
                              }),
                              phoneNumber: event.target.value,
                            },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </EditableLine>
                </div>
              </section>

              <section className="mt-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Hành động</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    label="Lưu thay đổi"
                    onClick={() =>
                      void vm.runAction(`user:${user.id}`, "update-user", {
                        userId: user.id,
                        fullName: draft?.fullName ?? user.fullName,
                        phoneNumber: (draft?.phoneNumber ?? user.phoneNumber ?? "") || null,
                        roleId: draft?.roleId || null,
                        aiLevel: draft?.aiLevel ?? user.aiLevel ?? 0,
                        accountType: draft?.accountType ?? user.accountType,
                        organizationId: draft?.organizationId || user.organizationId,
                        memberRole: draft?.memberRole || null,
                        departmentId: draft?.departmentId || null,
                        platformAdmin: draft?.platformAdmin ?? user.platformAdmin,
                        email: user.email,
                      })
                    }
                    disabled={!vm.canMutate || vm.savingKey === `user:${user.id}`}
                  />
                  <ActionButton
                    label={user.learningActivated ? "Huỷ kích hoạt" : "Kích hoạt"}
                    tone={user.learningActivated ? "danger" : "default"}
                    onClick={() =>
                      vm.confirmAction({
                        title: user.learningActivated
                          ? "Huỷ kích hoạt tài khoản học viên"
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
                    disabled={!vm.canMutate || vm.savingKey === `activation:${user.id}`}
                  />
                  <ActionButton
                    label="Xoá dữ liệu học"
                    tone="muted"
                    onClick={() =>
                      vm.confirmAction({
                        title: "Xoá dữ liệu học tập",
                        description:
                          "Tiến trình học, quiz, lịch sử chat, nhật ký và dữ liệu liên quan của user này sẽ bị xoá.",
                        confirmLabel: "Xoá dữ liệu",
                        tone: "destructive",
                        onConfirm: () =>
                          vm.runAction(`reset:${user.id}`, "reset-user-learning", {
                            userId: user.id,
                          }),
                      })
                    }
                    disabled={!vm.canMutate || vm.savingKey === `reset:${user.id}`}
                  />
                  <ActionButton
                    label="Sinh lại lộ trình"
                    tone="muted"
                    onClick={() =>
                      vm.confirmAction({
                        title: "Sinh lại lộ trình",
                        description:
                          "Xác nhận tạo lại lộ trình mới dựa trên trình độ và vai trò hiện tại của nhân viên.",
                        confirmLabel: "Sinh lại lộ trình",
                        onConfirm: () =>
                          vm.runAction(`regen:${user.id}`, "reset-user-learning", {
                            userId: user.id,
                            scope: "learning_recommendations",
                          }),
                      })
                    }
                    disabled={!vm.canMutate || vm.savingKey === `regen:${user.id}`}
                  />
                  <ActionButton
                    label={
                      (draft?.platformAdmin ?? user.platformAdmin)
                        ? "Gỡ quyền super-admin"
                        : "Cấp quyền super-admin"
                    }
                    tone="muted"
                    onClick={() => {
                      const isAdmin = draft?.platformAdmin ?? user.platformAdmin;
                      vm.confirmAction({
                        title: isAdmin
                          ? "Thu hồi quyền quản trị hệ thống"
                          : "Cấp quyền quản trị hệ thống",
                        description:
                          "Thao tác này sẽ thay đổi quyền truy cập cấp hệ thống và được ghi lại trong audit log.",
                        confirmLabel: isAdmin ? "Thu hồi quyền" : "Cấp quyền",
                        tone: "destructive",
                        onConfirm: () =>
                          vm.runAction(`admin:${user.id}`, "toggle-platform-admin", {
                            email: user.email,
                            enabled: !isAdmin,
                          }),
                      });
                    }}
                    disabled={!vm.canMutate || vm.savingKey === `admin:${user.id}`}
                  />
                  <ActionButton
                    label="Xoá tài khoản"
                    tone="danger"
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
                    disabled={!vm.canMutate || vm.savingKey === `delete:${user.id}`}
                  />
                </div>
              </section>

              <section className="mt-8 border-t border-line pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
                  Nhật ký hoạt động
                </h3>
                <div className="mt-4">
                  <UserActivityTimeline userId={user.id} />
                </div>
              </section>
            </div>
          ) : null}
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function MetaCard({
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
      <p className="mt-2 text-sm font-semibold text-ink break-words">{value}</p>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-1 text-sm text-ink break-words">{value}</p>
    </div>
  );
}

function EditableLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "muted" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50",
        tone === "danger"
          ? "border-destructive/20 bg-destructive/5 text-destructive hover:border-destructive/40"
          : tone === "muted"
            ? "border-line bg-secondary/40 text-ink-2 hover:border-brand hover:text-brand"
            : "border-brand/20 bg-brand-soft text-brand hover:border-brand",
      )}
    >
      {label}
    </button>
  );
}

type ActivityItem = {
  id: string;
  type: string;
  action: string;
  detail: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

function UserActivityTimeline({ userId }: { userId: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/manager/team/${userId}/activity`);
        const data = await res.json();
        if (!mounted) return;
        if (data.ok) {
          setActivities(data.items ?? []);
        } else {
          setError(data.error?.message ?? "Lỗi tải lịch sử");
        }
      } catch (err) {
        if (!mounted) return;
        setError("Lỗi kết nối");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  if (loading) return <div className="text-sm text-ink-3">Đang tải...</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (activities.length === 0) return <div className="text-sm text-ink-3">Chưa có hoạt động nào.</div>;

  const labelMap: Record<string, string> = {
    "activity:auth.login": "Đăng nhập hệ thống",
    "activity:lesson.view": "Xem bài học",
    "activity:lesson.start": "Bắt đầu bài học",
    "activity:lesson.complete": "Hoàn thành bài học",
    "activity:quiz.submit": "Nộp bài kiểm tra",
    "activity:chat.message": "Hỏi trợ lý AI",
    "activity:path.generate": "Tạo lộ trình học",
    "activity:path.select_update": "Cập nhật lộ trình",
    "activity:nhatky.log": "Ghi nhật ký",
  };

  return (
    <div className="space-y-4">
      {activities.map((a) => {
        const displayAction = labelMap[a.action] || a.action;
        let displayDetail = a.detail;
        if (!displayDetail && a.type === "event" && a.metadata) {
          try {
            displayDetail = Object.entries(a.metadata)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
          } catch {
            displayDetail = "Không có chi tiết";
          }
        }
        
        return (
          <div key={a.id} className="relative flex gap-4 pl-2">
          <div className="absolute bottom-0 left-4 top-8 w-px bg-line" />
          <div className="relative z-10 grid h-5 w-5 flex-none place-items-center rounded-full bg-card ring-4 ring-card">
            {a.type === "progress" && a.metadata?.status === "hoan-thanh" && (
              <CheckCircle2 className="h-4 w-4 text-brand" />
            )}
            {a.type === "progress" && a.metadata?.status !== "hoan-thanh" && (
              <PlayCircle className="h-4 w-4 text-accent" />
            )}
            {a.type === "quiz" && <HelpCircle className="h-4 w-4 text-ink-2" />}
            {a.type === "time_log" && <Timer className="h-4 w-4 text-brand" />}
            {a.type === "event" && <Activity className="h-4 w-4 text-ink-3" />}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-ink">{displayAction}</p>
            {displayDetail && <p className="text-xs text-ink-2 mt-0.5 truncate">{displayDetail}</p>}
            <p className="mt-1 text-[11px] font-medium text-ink-3">
              {new Date(a.timestamp).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
            </p>
          </div>
        </div>
        );
      })}
    </div>
  );
}
