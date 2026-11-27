import { isPlatformAdminUser } from "@/lib/platform-admin-auth";
import { redirect } from "next/navigation";
import { PlatformAdminTabWrapper } from "@/components/platform-admin/tab-wrapper";

export const metadata = {
  title: "Quản lý người dùng · AI Trợ Lý",
};

export default async function NguoiDungPage() {
  if (!(await isPlatformAdminUser())) {
    redirect("/van-hanh/login");
  }

  return (
    <PlatformAdminTabWrapper tabKey="nguoi-dung" />
  );
}
