import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoKyNangContent } from "@/components/bo-ky-nang-content";
import {
  canAccessLearning,
  loadLearningActivationRecord,
} from "@/lib/learning-activation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const metadata: Metadata = {
  title: "Bộ kỹ năng · AI Trợ Lý",
};

export default async function BoKyNangPage() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const access = await loadLearningActivationRecord(user.id);
    if (access.isPlatformAdmin) redirect("/van-hanh");
    if (access.isManager) redirect("/quan-ly");
    if (!access.roleId) redirect("/onboarding");
    if (!canAccessLearning(access)) redirect("/cho-kich-hoat");
  }

  return <BoKyNangContent />;
}
