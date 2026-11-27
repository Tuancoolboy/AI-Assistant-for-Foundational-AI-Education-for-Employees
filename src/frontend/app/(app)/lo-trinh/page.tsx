import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoTrinhContent } from "@/components/lo-trinh-content";
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
  title: "Lộ trình · AI Trợ Lý",
};

export default async function LoTrinhPage() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const access = await loadLearningActivationRecord(user.id);
    if (access.isPlatformAdmin) redirect("/van-hanh");
    if (access.isManager) redirect("/quan-ly");
    if (!access.roleId) redirect("/onboarding");
    if (!canAccessLearning(access)) redirect("/cho-kich-hoat");

    // §7 precondition: chưa làm bài đánh giá → đẩy về onboarding (nơi có bài đánh giá).
    // NGOẠI LỆ: tài khoản đã được nạp lộ trình sẵn (generated_learning_paths) thì cho vào
    // thẳng, KHÔNG bắt làm lại onboarding.
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("assessment_result, learning_path_confirmed_at")
      .eq("id", user.id)
      .maybeSingle<{ assessment_result: unknown | null; learning_path_confirmed_at: string | null }>();
    if (!profile?.assessment_result) {
      const { data: preset } = await supabase
        .from("generated_learning_paths")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!preset) redirect("/onboarding");
    }
    // Chưa xác nhận lộ trình → đẩy về màn gợi ý để tạo.
    if (!profile?.learning_path_confirmed_at) redirect("/lo-trinh/goi-y");
  }

  return <LoTrinhContent />;
}
