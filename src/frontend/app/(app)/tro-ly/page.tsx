import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TroLyChat } from "@/components/tro-ly-chat";
import {
  resolveAppUserDisplayName,
  resolveAppUserType,
} from "@/lib/app-user";
import {
  canAccessLearning,
  loadLearningActivationRecord,
} from "@/lib/learning-activation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const metadata: Metadata = {
  title: "Trợ lý AI · AI Trợ Lý",
};

export default async function TroLyPage() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const access = await loadLearningActivationRecord(user.id);
    if (access.isPlatformAdmin) redirect("/van-hanh");
    if (!access.roleId) redirect("/onboarding");
    if (!canAccessLearning(access) && !access.isManager) {
      redirect("/cho-kich-hoat");
    }
  }

  const userType = await resolveAppUserType();
  const displayName = await resolveAppUserDisplayName();

  return <TroLyChat userType={userType} displayName={displayName} />;
}
