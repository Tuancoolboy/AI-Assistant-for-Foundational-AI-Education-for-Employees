import { isPlatformAdminUser } from "@/lib/platform-admin-auth";
import { redirect } from "next/navigation";
import { PlatformAdminTabWrapper } from "@/components/platform-admin/tab-wrapper";

export const metadata = {
  title: "Tổng quan vận hành · AI Trợ Lý",
};

export default async function TongQuanPage() {
  if (!(await isPlatformAdminUser())) {
    redirect("/van-hanh/login");
  }

  return (
    <PlatformAdminTabWrapper tabKey="tong-quan" />
  );
}
