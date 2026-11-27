import type { ChatGraphStateType } from "./graph-state";
import { getOpenAIClient, getFallbackAnswer } from "@/lib/openai";
import { stripLeadingAssistantGreeting } from "@/lib/chat-prompt-safety";
import type { RoleId } from "@/lib/openai";
import { getSetting } from "@/lib/site-settings";

export async function llmRespondNode(state: ChatGraphStateType) {
  const augmentedPrompt = state.augmentedPrompt || "";
  const systemPrompt = state.systemPrompt || "Bạn là Trợ lý AI.";
  const query = state.query || "";
  const metadata = state.metadata || {};
  const onToken = metadata.onToken as ((token: string) => void) | undefined;
  const roleId = (state.roleId || "khac") as RoleId;

  const client = getOpenAIClient();
  if (!client) {
    // Fallback if OpenAI key is not configured
    const fallback = getFallbackAnswer(query, roleId);
    const answer = stripLeadingAssistantGreeting(fallback.answer);
    if (onToken) {
      onToken(answer);
    }
    return { response: answer };
  }

  try {
    const isSynthesis = !!metadata.synthesis;
    const model = isSynthesis
      ? await getSetting("synthesis_model")
      : await getSetting("chat_model");
    const maxTokens = (metadata.maxTokens as number) || 600;

    const maxHistory = await getSetting("max_history_messages");
    const history = (state.history || []).slice(-maxHistory);
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history,
      { role: "user" as const, content: augmentedPrompt },
    ];

    const stream = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        fullResponse += token;
        if (onToken) {
          onToken(token);
        }
      }
    }

    return { response: fullResponse };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Xin lỗi, đã xảy ra sự cố kết nối với mô hình AI.";
    console.error("[llmRespondNode] Error calling OpenAI:", err);
    return {
      error: message,
      response: "Xin lỗi, đã xảy ra sự cố kết nối với mô hình AI.",
    };
  }
}
