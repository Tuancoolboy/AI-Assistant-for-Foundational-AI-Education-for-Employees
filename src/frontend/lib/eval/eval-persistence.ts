import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { FullEvalReport } from "./eval-metrics";
import { getOpenAIModel } from "@/lib/openai";

export async function saveChatEvaluation(
  userId: string,
  conversationId: string,
  report: FullEvalReport,
): Promise<void> {
  if (!isSupabaseConfigured() || !userId || !conversationId) return;

  try {
    const supabase = await createSupabaseServerClient();
    const faithfulnessVal = report.faithfulness.score;
    const relevancyVal = report.answerRelevancy.score;
    const recallVal = report.contextRecall.score;
    const overall = (faithfulnessVal + relevancyVal + recallVal) / 3;
    const model = getOpenAIModel();

    const { error } = await supabase.from("chat_evaluations").insert({
      conversation_id: conversationId,
      user_id: userId,
      faithfulness: faithfulnessVal,
      faithfulness_reasoning: report.faithfulness.reasoning,
      answer_relevancy: relevancyVal,
      answer_relevancy_reasoning: report.answerRelevancy.reasoning,
      context_recall: recallVal,
      context_recall_reasoning: report.contextRecall.reasoning,
      overall_score: overall,
      eval_model: model,
    });

    if (error) {
      console.error("[saveChatEvaluation] Database error:", error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[saveChatEvaluation] Persistence failed:", message);
  }
}
