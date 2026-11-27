import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Trợ Lý — Học AI sát công việc của bạn trong tuần đầu",
  description:
    "Lộ trình AI cá nhân hóa theo vai trò + trợ lý AI giải thích bằng ví dụ thực tế. Dành cho nhân viên SME Việt Nam.",
};

// Mobile-first: tránh trình duyệt tự phóng to gây tràn ngang trên màn nhỏ (iPhone SE 375px).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const fontVariables: CSSProperties = {
  ["--font-sans" as string]:
    '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  ["--font-display" as string]:
    '"Bricolage Grotesque", "Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  ["--font-geist-mono" as string]:
    '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Monaco, monospace',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased" style={fontVariables}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Đo LCP/CLS/INP thật từ người dùng — dữ liệu về Vercel dashboard.
            Cần số đo này trước khi quyết định có refactor RSC cho perf hay không
            (QA finding A-02: nghi ngờ LCP > 3s nhưng chưa có số thực). */}
        <SpeedInsights />
      </body>
    </html>
  );
}
