// Cộng điểm học tập vào points_ledger (nguồn cho bảng xếp hạng).
// Idempotent theo (user_id, source, ref_id) để không cộng trùng khi học/làm lại.
// Fail-open: lỗi ghi điểm KHÔNG chặn luồng học chính.

import type { SupabaseClient } from "@supabase/supabase-js";

// Hoàn thành 1 bài = +5; đạt bài kiểm tra (>=70%) = +15.
export const POINTS_LESSON_COMPLETE = 5;
export const POINTS_QUIZ_PASSED = 15;

// source enum hiện có ('lesson' | 'share' | 'challenge'). Bài học dùng 'lesson';
// đạt quiz dùng 'challenge' để phân biệt với điểm hoàn thành bài (cùng ref_id module).
export type PointsSource = "lesson" | "share" | "challenge";

export async function awardPointsOnce(
  supabase: SupabaseClient,
  params: {
    userId: string;
    source: PointsSource;
    points: number;
    refId: string;
    organizationId?: string | null;
  },
): Promise<{ awarded: boolean }> {
  try {
    const { data: existing } = await supabase
      .from("points_ledger")
      .select("user_id")
      .eq("user_id", params.userId)
      .eq("source", params.source)
      .eq("ref_id", params.refId)
      .maybeSingle();
    if (existing) return { awarded: false };

    const { error } = await supabase.from("points_ledger").insert({
      user_id: params.userId,
      organization_id: params.organizationId ?? null,
      source: params.source,
      points: params.points,
      ref_id: params.refId,
    });
    if (error) {
      console.warn("[points] insert failed:", error.message);
      return { awarded: false };
    }
    return { awarded: true };
  } catch (e) {
    console.warn("[points] award error:", e);
    return { awarded: false };
  }
}
