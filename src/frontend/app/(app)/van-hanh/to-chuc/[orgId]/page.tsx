"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePlatformAdminConsole } from "@/hooks/use-platform-admin-console";
import { OrganizationDetailView } from "@/components/platform-admin/organization-detail-view";

export default function OrganizationPage({ params }: { params: Promise<{ orgId: string }> }) {
  const resolvedParams = use(params);
  const vm = usePlatformAdminConsole();

  if (vm.loading) {
    return <div className="p-8 text-center text-ink-2 animate-pulse">Đang tải dữ liệu tổ chức...</div>;
  }

  const organization = vm.report?.organizations.find((org) => org.id === resolvedParams.orgId) ?? null;

  if (!organization) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink-2 mb-4">Không tìm thấy tổ chức hoặc bạn không có quyền truy cập.</p>
        <Link href="/van-hanh" className="text-brand hover:underline">
          Quay lại bảng điều khiển
        </Link>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/van-hanh"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-3 transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Về bảng điều khiển
        </Link>
      </div>
      
      <OrganizationDetailView vm={vm} organization={organization} />
    </main>
  );
}
