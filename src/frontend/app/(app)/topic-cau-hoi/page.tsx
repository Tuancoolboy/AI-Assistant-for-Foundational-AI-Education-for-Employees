import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { TopicCauHoiBoard } from "@/components/topic-cau-hoi-board";

export const metadata: Metadata = {
  title: "Topic: Câu hỏi chưa có lời giải · AI Trợ Lý",
};

export default async function TopicCauHoiPage() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          Topic: Câu hỏi chưa có lời giải
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Những câu hỏi AI chưa trả lời được — cộng đồng cùng giúp nhau.
          Lời giải được chấp nhận sẽ được cộng <span className="font-semibold text-brand">+15 điểm</span>.
        </p>
      </div>

      <TopicCauHoiBoard />
    </div>
  );
}
