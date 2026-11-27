import type { Metadata } from "next";
import { AuthLoginForm } from "@/components/auth-login-form";

export const metadata: Metadata = {
  title: "Đăng nhập · AI Trợ Lý",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
    verified?: string;
    registered?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const nextFromQuery = query.next ?? null;
  const urlError = query.error ?? null;
  const urlSuccess = query.verified ?? null;
  const registered = query.registered === "1";

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Chào mừng trở lại
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
          Đăng nhập
        </h1>
        <p className="mt-1.5 text-sm text-ink-2">
          Tiếp tục lộ trình AI của bạn.
        </p>
      </div>
      <AuthLoginForm
        nextFromQuery={nextFromQuery}
        urlError={urlError}
        urlSuccess={urlSuccess}
        registered={registered}
      />
      <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs text-ink-2">
        <p className="font-semibold text-accent">Demo thật — đã có lộ trình HR:</p>
        <p className="mt-1">
          • <code className="font-mono">demo@mocan.vn</code> /{" "}
          <code className="font-mono">mocan2026</code> → Mộc An (HR, lộ trình đầy đủ)
        </p>
        <p className="mt-1 text-ink-3">Hoặc đăng ký tài khoản mới bên dưới.</p>
      </div>
    </div>
  );
}
