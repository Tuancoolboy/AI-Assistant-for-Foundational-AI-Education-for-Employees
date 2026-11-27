import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModuleLessonContent } from "@/components/module-lesson-content";
import { fetchModuleById } from "@/lib/learning-modules";
import { isModuleAccessBlocked } from "@/lib/learning-path-access";
import { canAccessModule, loadLearningAccess } from "@/lib/learning-access";
import { loadLearningActivationRecord } from "@/lib/learning-activation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

type PageProps = {
  params: Promise<{ moduleId: string }>;
  searchParams?: Promise<{ extra?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { moduleId } = await params;
  const mod = await fetchModuleById(moduleId);
  return {
    title: mod ? `${mod.title} · Lộ trình` : "Bài học · AI Trợ Lý",
  };
}

export default async function ModuleLessonPage({ params, searchParams }: PageProps) {
  const { moduleId } = await params;
  const query = (await searchParams) ?? {};
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const access = await loadLearningActivationRecord(user.id);
    if (access.isPlatformAdmin) redirect("/van-hanh");
    if (access.isManager) redirect("/quan-ly");
    if (!access.roleId) redirect("/onboarding");

    const learningAccess = await loadLearningAccess(user.id);
    if (!canAccessModule(learningAccess, moduleId)) {
      redirect("/nang-cap");
    }

    // Chặn mở bài thuộc tier bị khoá (bài kỹ năng thêm dùng ?extra=1 → bỏ qua chặn).
    if (query.extra !== "1" && (await isModuleAccessBlocked(user.id, moduleId))) {
      redirect("/lo-trinh");
    }
  }
  return (
    <ModuleLessonContent
      moduleId={moduleId}
      fromExtraSuggestion={query.extra === "1"}
    />
  );
}
