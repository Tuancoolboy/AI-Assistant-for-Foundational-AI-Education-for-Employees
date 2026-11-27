"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Users } from "lucide-react";

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
  { key: "cai-dat", label: "Cài đặt" },
] as const;

export default function VanHanhLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:py-10 animate-in fade-in duration-300">
      <header className="border-b border-line pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-brand">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Platform Admin Console
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                super-admin
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
        </div>

        <nav
          aria-label="Điều hướng tab vận hành"
          className="mt-5 flex gap-2 border-t border-line pt-4 overflow-x-auto pb-1.5 scroll-smooth whitespace-nowrap"
          style={{ scrollbarWidth: "none" }}
        >
          {tabs.map((item) => {
            const path = `/van-hanh/${item.key}`;
            const active = pathname === path || (item.key === "tong-quan" && pathname === "/van-hanh");

            return (
              <Link
                key={item.key}
                href={path}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                  active
                    ? "border-brand/20 bg-brand-soft text-brand shadow-sm scale-[1.02]"
                    : "border-line bg-card text-ink-2 hover:border-brand hover:text-brand",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
