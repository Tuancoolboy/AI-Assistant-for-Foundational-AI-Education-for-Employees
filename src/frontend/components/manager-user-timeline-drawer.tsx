"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@base-ui/react/drawer";
import {
  X,
  Activity,
  CheckCircle2,
  PlayCircle,
  HelpCircle,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/team-data";

type ActivityItem = {
  id: string;
  type: string;
  action: string;
  detail: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export function ManagerUserTimelineDrawer({
  member,
  onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  const open = Boolean(member);

  return (
    <Drawer.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[1px]" />
        <Drawer.Popup
          initialFocus={false}
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-[min(94vw,32rem)] flex-col border-l border-line bg-card shadow-2xl outline-none",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Tiến trình học tập
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink">
                {member?.fullName ?? "Nhân viên"}
              </h2>
              {member?.email && (
                <p className="mt-1 text-sm text-ink-2">{member.email}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-secondary/40 px-3 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand"
              aria-label="Đóng tiến trình"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {member ? (
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <UserActivityTimeline userId={member.id} />
            </div>
          ) : null}
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

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
  if (activities.length === 0)
    return <div className="text-sm text-ink-3">Chưa có hoạt động nào.</div>;

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
              {displayDetail && (
                <p className="text-xs text-ink-2 mt-0.5 truncate">
                  {displayDetail}
                </p>
              )}
              <p className="mt-1 text-[11px] font-medium text-ink-3">
                {new Date(a.timestamp).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
