import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoadmapSuggestionForm } from "@/components/roadmap-suggestion-form";
import {
  canAccessLearning,
  loadLearningActivationRecord,
} from "@/lib/learning-activation";
import {
  createSupabaseServerClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const metadata: Metadata = {
  title: "Lộ trình gợi ý · AI Trợ Lý",
};

export default async function LoTrinhGoiYPage() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const access = await loadLearningActivationRecord(user.id);
    if (access.isPlatformAdmin) redirect("/van-hanh");
    if (access.isManager) redirect("/quan-ly");
    if (!access.roleId) redirect("/onboarding");
    if (!canAccessLearning(access)) redirect("/cho-kich-hoat");

    // Chưa làm bài đánh giá và không có lộ trình preset → về onboarding.
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("assessment_result")
      .eq("id", user.id)
      .maybeSingle<{ assessment_result: unknown | null }>();
    if (!profile?.assessment_result) {
      const { data: preset } = await supabase
        .from("generated_learning_paths")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!preset) redirect("/onboarding");
    }
    // NOTE: Không redirect khi đã confirmed — màn này cho phép chỉnh lại lộ trình.
  }

  return <RoadmapSuggestionForm />;
}
