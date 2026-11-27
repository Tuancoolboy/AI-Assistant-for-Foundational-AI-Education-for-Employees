import type { ChatGraphStateType } from "./graph-state";
import { evalFaithfulness, evalAnswerRelevancy, evalContextRecall } from "@/lib/eval/eval-metrics";
import { saveChatEvaluation } from "@/lib/eval/eval-persistence";

import { getSetting } from "@/lib/site-settings";

export async function evalNode(state: ChatGraphStateType) {
  const query = state.query || "";
  const response = state.response || "";
  const contexts = state.retrievedContexts || [];
  const userId = state.userId;
  const conversationId = (state.metadata?.conversationId as string) || "";
  const skipEval = state.metadata?.skipEval === true;

  if (skipEval) {
    return { evaluationScore: null };
  }

  // Only the DB-backed setting decides whether runtime evaluation is enabled.
  const isEnabled = await getSetting("enable_chat_eval");
  if (!isEnabled || !response.trim()) {
    return { evaluationScore: null };
  }

  // Best-effort observability: do not block graph completion on 3 judge LLM calls.
  void runChatEvaluation({ query, response, contexts, userId, conversationId });

  return { evaluationScore: null };
}

interface RunEvalArgs {
  query: string;
  response: string;
  contexts: string[];
  userId: string;
  conversationId: string;
}

export async function runChatEvaluation({
  query,
  response,
  contexts,
  userId,
  conversationId,
}: RunEvalArgs): Promise<void> {
  try {
    const [faithfulness, relevancy, recall] = await Promise.all([
      evalFaithfulness(response, contexts),
      evalAnswerRelevancy(query, response),
      evalContextRecall(query, contexts),
    ]);

    const overall = (faithfulness.score + relevancy.score + recall.score) / 3;

    console.log(
      `[evalNode] Results: Faithfulness=${faithfulness.score}, Relevancy=${relevancy.score}, Recall=${recall.score}, Overall=${overall}`,
    );

    if (userId && conversationId) {
      await saveChatEvaluation(userId, conversationId, {
        faithfulness,
        answerRelevancy: relevancy,
        contextRecall: recall,
      });
    }
  } catch (err) {
    console.error("[evalNode] Error running evaluation:", err);
  }
}
