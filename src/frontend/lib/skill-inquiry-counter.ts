import { createSupabaseServiceClient } from "@/lib/supabase/server";

// Đếm số lần hỏi lại 1 kỹ năng ĐÃ học (per user) → cấp độ cà khịa CASE A.
// Ghi/đọc qua service role + RPC atomic (chống lost update khi spam). Xem specs/BE-14 §3.6.

export async function loadSkillInquiryCount(
  userId: string,
  skillKey: string,
): Promise<number> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("skill_inquiry_counters")
      .select("reask_count")
      .eq("user_id", userId)
      .eq("skill_key", skillKey)
      .maybeSingle();
    if (error) {
      console.error("[skill-inquiry-counter:load]", error.message);
      return 0;
    }
    return typeof data?.reask_count === "number" ? data.reask_count : 0;
  } catch (err) {
    console.error("[skill-inquiry-counter:load]", err);
    return 0;
  }
}

// Tăng counter atomic, trả về count mới. Fail-open: lỗi DB không chặn câu trả lời.
export async function bumpSkillInquiryCounter(
  userId: string,
  skillKey: string,
  moduleId: string | null,
  skillSlug: string | null,
): Promise<number> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("bump_skill_inquiry_counter", {
      p_user_id: userId,
      p_skill_key: skillKey,
      p_module_id: moduleId,
      p_skill_slug: skillSlug,
    });
    if (error) {
      console.error("[skill-inquiry-counter:bump]", error.message);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.error("[skill-inquiry-counter:bump]", err);
    return 0;
  }
}
