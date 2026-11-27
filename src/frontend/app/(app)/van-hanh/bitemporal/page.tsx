import { isPlatformAdminUser } from "@/lib/platform-admin-auth";
import { redirect } from "next/navigation";
import { PlatformAdminTabWrapper } from "@/components/platform-admin/tab-wrapper";

export const metadata = {
  title: "Bitemporal Memory Explorer · AI Trợ Lý",
};

export default async function BitemporalPage() {
  if (!(await isPlatformAdminUser())) {
    redirect("/van-hanh/login");
  }

  return (
    <PlatformAdminTabWrapper tabKey="bitemporal" />
  );
}
