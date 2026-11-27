import { redirect } from "next/navigation";
import { isPlatformAdminUser } from "@/lib/platform-admin-auth";

export default async function VanHanhPage() {
  if (!(await isPlatformAdminUser())) {
    redirect("/van-hanh/login");
  }

  redirect("/van-hanh/tong-quan");
}
