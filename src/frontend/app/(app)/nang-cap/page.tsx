import Link from "next/link";

export default function UpgradePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Nâng cấp quyền học
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
          Bạn đã học hết phần trải nghiệm miễn phí.
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-2">
          Tài khoản lẻ được mở 3 bài đầu để trải nghiệm. Để học tiếp, bạn có thể
          chờ công ty kích hoạt gói học hoặc liên hệ đội vận hành để được mở
          quyền đầy đủ.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/lo-trinh"
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground transition hover:bg-brand-2"
          >
            Quay lại lộ trình
          </Link>
          <Link
            href="/tai-khoan"
            className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-card px-6 text-sm font-semibold text-ink transition hover:border-brand/50"
          >
            Xem tài khoản
          </Link>
        </div>
      </div>
    </main>
  );
}
