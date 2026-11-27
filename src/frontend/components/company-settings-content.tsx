"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createOrganization,
  updateCurrentOrganization,
  fetchManagerInviteLink,
  createManagerInviteLink,
  rotateManagerInviteLink,
  type OrganizationSummary,
} from "@/lib/client-api";
import { slugifyOrganizationName } from "@/lib/organization-slug";

type CompanySettingsContentProps = {
  initialOrganization: OrganizationSummary | null;
  membershipRole: string | null;
};

export function CompanySettingsContent({
  initialOrganization,
  membershipRole,
}: CompanySettingsContentProps) {
  const router = useRouter();
  const isOwner = membershipRole === "owner";
  const canCreate = !initialOrganization;

  const [name, setName] = useState(initialOrganization?.name ?? "");
  const [slugPreview, setSlugPreview] = useState(initialOrganization?.slug ?? "");
  const [logoUrl, setLogoUrl] = useState(initialOrganization?.logoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    if (!canCreate && initialOrganization) {
      const load = async () => {
        await Promise.resolve();
        if (!active) return;
        setLoadingInvite(true);
        try {
          const res = await fetchManagerInviteLink();
          if (active && res.ok && res.link) {
            setInviteLink(res.link.url);
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setLoadingInvite(false);
        }
      };
      void load();
    }
    return () => {
      active = false;
    };
  }, [canCreate, initialOrganization]);

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }

  async function handleCreateInviteLink() {
    setLoadingInvite(true);
    try {
      const res = await createManagerInviteLink();
      if (res.ok && res.link) {
        setInviteLink(res.link.url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvite(false);
    }
  }

  async function handleRotateLink() {
    if (!window.confirm("Xác nhận xoay link mời? Tất cả link mời cũ sẽ bị vô hiệu hoá lập tức.")) {
      return;
    }
    setLoadingInvite(true);
    try {
      const res = await rotateManagerInviteLink();
      if (res.ok && res.link) {
        setInviteLink(res.link.url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvite(false);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    if (canCreate) {
      setSlugPreview(slugifyOrganizationName(value));
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await createOrganization({ name, slug: slugPreview });
      setMessage(result.message ?? "Đã tạo công ty.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được công ty.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !isOwner) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await updateCurrentOrganization({
        name,
        logoUrl: logoUrl.trim() || null,
      });
      setMessage(result.message ?? "Đã cập nhật công ty.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được công ty.");
    } finally {
      setSaving(false);
    }
  }

  if (canCreate) {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Thiết lập công ty
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
          Tạo không gian học AI cho công ty
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-2">
          Sau khi tạo, bạn sẽ nhận link công ty ổn định để mời nhân viên tham gia.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleCreate}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">Tên công ty</span>
            <input
              className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none focus:border-brand"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="VD: Công ty ABC"
              required
              minLength={2}
            />
          </label>

          <div className="rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink-2">
            Link công ty dự kiến:{" "}
            <span className="font-medium text-ink">
              /c/{slugPreview || "cong-ty"}
            </span>
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-2 disabled:opacity-60"
          >
            {saving ? "Đang tạo..." : "Tạo công ty"}
          </button>
        </form>
      </section>
    );
  }

  const entryPath = `/c/${initialOrganization.slug}`;

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      {/* Header Bento Card */}
      <div className="rounded-3xl border border-line bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            Không gian doanh nghiệp
          </span>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
            {initialOrganization.name}
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            Vai trò của bạn:{" "}
            <span className="font-semibold text-ink-2 capitalize">
              {membershipRole === "owner"
                ? "Chủ doanh nghiệp"
                : membershipRole === "manager"
                  ? "Quản lý"
                  : "Nhân viên"}
            </span>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 uppercase">
            Đang hoạt động
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main section */}
        <div className="md:col-span-2 space-y-6">
          {/* Bento Invite Link Card */}
          <div className="rounded-3xl border border-line bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-ink">Liên kết gia nhập thành viên</h2>
            <p className="mt-1 text-xs text-ink-3">
              Mời nhân viên của bạn tham gia hệ thống học tập bằng cách chia sẻ link này.
            </p>
            
            <div className="mt-4">
              {loadingInvite ? (
                <div className="h-10 w-full animate-pulse rounded-xl bg-secondary/35" />
              ) : inviteLink ? (
                <div className="flex items-center gap-2 rounded-xl border border-line bg-secondary/15 p-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="w-full bg-transparent px-2 text-xs font-mono text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand-2 transition"
                  >
                    {copied ? "Đã sao chép" : "Sao chép"}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line bg-secondary/10 p-6 text-center">
                  <p className="text-xs text-ink-3">Chưa có liên kết mời hoạt động.</p>
                  <button
                    type="button"
                    onClick={handleCreateInviteLink}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand-2 transition"
                  >
                    Tạo liên kết mời
                  </button>
                </div>
              )}
            </div>

            {inviteLink && (
              <div className="mt-4 flex justify-between items-center text-xs">
                <span className="text-ink-3">
                  Liên kết này có hiệu lực cho đến khi được xoay (rotate).
                </span>
                <button
                  type="button"
                  onClick={handleRotateLink}
                  className="text-brand hover:underline font-semibold"
                >
                  Xoay link mời mới
                </button>
              </div>
            )}
          </div>

          {/* Bento Update Profile Card */}
          <div className="rounded-3xl border border-line bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-ink">Cấu hình hồ sơ doanh nghiệp</h2>
            
            {isOwner ? (
              <form className="mt-4 space-y-4" onSubmit={handleUpdate}>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-ink-2">Tên hiển thị</span>
                  <input
                    className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none focus:border-brand"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    minLength={2}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-ink-2">Logo URL (tuỳ chọn)</span>
                  <input
                    className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none focus:border-brand"
                    value={logoUrl}
                    onChange={(event) => setLogoUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>

                {error && (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand">
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-2 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </form>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-ink-3">
                Chỉ chủ công ty mới chỉnh sửa được cài đặt. Liên hệ quản trị viên của bạn nếu cần đổi thông tin hiển thị.
              </p>
            )}
          </div>
        </div>

        {/* Side section */}
        <div className="space-y-6">
          {/* Card: Member Privileges */}
          <div className="rounded-3xl border border-line bg-card p-6 shadow-sm space-y-4">
            <h3 className="font-display text-md font-bold text-ink">Bảng quyền hạn thành viên</h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex flex-col gap-1 border-b border-line/60 pb-2">
                <span className="font-semibold text-brand">Chủ doanh nghiệp (Owner)</span>
                <span className="text-ink-2 leading-relaxed">Xem kết quả, quản lý thành viên, đổi cấu hình hồ sơ và xoay link mời gia nhập.</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-line/60 pb-2">
                <span className="font-semibold text-sky-600">Quản lý (Manager)</span>
                <span className="text-ink-2 leading-relaxed">Xem kết quả học tập của nhân viên, phân quyền học tập, lấy link mời.</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-ink-2">Nhân viên (Employee)</span>
                <span className="text-ink-2 leading-relaxed">Truy cập học tập lộ trình được giao, tham gia làm bài kiểm tra quiz/assessment.</span>
              </div>
            </div>
          </div>
          
          {/* Card: Direct workspace link */}
          <div className="rounded-3xl border border-line bg-card p-6 shadow-sm space-y-3">
            <h3 className="font-display text-md font-bold text-ink">Không gian làm việc</h3>
            <p className="text-xs text-ink-3">Đường dẫn trực tiếp dành cho nhân viên trong công ty đăng nhập:</p>
            <div className="rounded-xl bg-secondary/10 p-3 font-mono text-xs text-brand select-all border border-line/40 break-all text-center font-semibold">
              /c/{initialOrganization.slug}
            </div>
            <Link href={entryPath} className="mt-2 block w-full rounded-full bg-secondary/30 hover:bg-secondary/45 py-2.5 text-center text-xs font-semibold text-ink transition">
              Truy cập Không gian
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
