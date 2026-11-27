import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KiemTraQuiz } from "@/components/kiem-tra-quiz";
import { resolveQuizReturnHref } from "@/lib/hoc-tap-quiz-catalog";
import {
  canAccessLearning,
  loadLearningActivationRecord,
} from "@/lib/learning-activation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { type Tier } from "@/lib/learning-tiers";

export const metadata: Metadata = {
  title: "Bài kiểm tra · AI Trợ Lý",
};

export default async function KiemTraPage({
  params,
  searchParams,
}: {
  params: Promise<{ roleId: string }>;
  searchParams?: Promise<{
    tier?: string;
    from?: string | string[];
    quiz?: string | string[];
  }>;
}) {
  const { roleId } = await params;
  const query = (await searchParams) ?? {};
  const tierRaw = Number(query.tier);
  const tier = tierRaw >= 1 && tierRaw <= 4 ? (tierRaw as Tier) : null;
  const returnHref = resolveQuizReturnHref(query.from);
  const hocTapQuizId =
    returnHref === "/hoc-tap" && typeof query.quiz === "string"
      ? query.quiz
      : null;

  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const access = await loadLearningActivationRecord(user.id);
    if (access.isPlatformAdmin) redirect("/van-hanh");
    if (access.isManager) redirect("/quan-ly");
    if (!access.roleId) redirect("/onboarding");
    if (!canAccessLearning(access)) redirect("/cho-kich-hoat");
  }

  return (
    <KiemTraQuiz
      roleId={roleId}
      tier={tier}
      returnHref={returnHref}
      hocTapQuizId={hocTapQuizId}
    />
  );
}
