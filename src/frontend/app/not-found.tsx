import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import {
  DEMO_SESSION_COOKIE,
  isSupabaseConfigured,
} from "@/lib/supabase/is-configured";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Không tìm thấy trang · AI Trợ Lý",
};

// Route-group not-found.tsx (vd. app/(app)/not-found.tsx) chỉ áp dụng khi
// một route ĐÃ khớp gọi notFound() — với URL hoàn toàn không tồn tại,
// Next.js luôn fallback về file not-found.tsx này ở gốc, không kế thừa
// layout (app). Vì vậy phải tự kiểm tra session + hiện nav tối giản ở đây.
async function isLoggedIn(): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    return Boolean(user);
  }
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_SESSION_COOKIE)?.value === "true";
}

const QUICK_LINKS = [
  { href: "/lo-trinh", label: "Lộ trình" },
  { href: "/tro-ly", label: "Trợ lý AI" },
  { href: "/bang-xep-hang", label: "Xếp hạng" },
  { href: "/tien-bo", label: "Tiến bộ" },
];

export default async function NotFound() {
  const loggedIn = await isLoggedIn();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {loggedIn && (
        <nav className="border-b border-ink/10 px-6 py-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 text-sm">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ink-2 transition hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-6xl font-bold text-brand">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">
          Không tìm thấy trang
        </h1>
        <p className="mt-2 max-w-md text-ink-2">
          Đường dẫn có thể đã đổi hoặc trang không tồn tại.
        </p>
        <Link
          href={loggedIn ? "/lo-trinh" : "/"}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-brand px-7 text-base font-semibold text-brand-foreground transition hover:bg-brand-2"
        >
          {loggedIn ? "Về Lộ trình" : "Về trang chủ"}
        </Link>
      </div>
    </div>
  );
}
