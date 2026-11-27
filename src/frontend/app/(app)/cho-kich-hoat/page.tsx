import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadLearningActivationRecord } from "@/lib/learning-activation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const metadata: Metadata = {
  title: "Chờ kích hoạt · AI Trợ Lý",
};

export default async function ChoKichHoatPage() {
  if (!isSupabaseConfigured()) {
    redirect("/lo-trinh");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await loadLearningActivationRecord(user.id);
  if (access.isPlatformAdmin) redirect("/van-hanh");
  if (access.isManager) redirect("/quan-ly");
  if (!access.roleId) redirect("/onboarding");
  redirect("/lo-trinh");
}
