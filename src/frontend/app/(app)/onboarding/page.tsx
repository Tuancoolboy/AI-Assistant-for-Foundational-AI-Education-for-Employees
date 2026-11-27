import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding-flow";
import {
  fetchPublishedModuleCounts,
  fetchPublishedModuleIds,
} from "@/lib/learning-modules";

export const metadata: Metadata = {
  title: "Onboarding · AI Trợ Lý",
};

export default async function OnboardingPage() {
  // Số bài thật từ DB (published): counts cho teaser, ids để màn kết quả tính
  // đúng số bài học được (giao với lựa chọn khảo sát) — khớp số ở /lo-trinh.
  const [moduleCounts, moduleIds] = await Promise.all([
    fetchPublishedModuleCounts(),
    fetchPublishedModuleIds(),
  ]);
  return <OnboardingFlow moduleCounts={moduleCounts} moduleIds={moduleIds} />;
}
