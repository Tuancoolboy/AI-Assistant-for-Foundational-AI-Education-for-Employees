export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function estimateMessageTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function estimateConversationTokens(messages: ChatMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message.content) + 4,
    0,
  );
}

export function trimChatMessagesToBudget(
  messages: ChatMessage[],
  maxInputTokens: number,
): ChatMessage[] {
  if (messages.length <= 1) return messages.slice();

  const systemMessage =
    messages[0]?.role === "system" ? messages[0] : undefined;
  const history = systemMessage ? messages.slice(1) : messages.slice();

  const maxHistoryTokens = Math.max(0, maxInputTokens - (systemMessage ? estimateMessageTokens(systemMessage.content) + 4 : 0));

  if (estimateConversationTokens(history) <= maxHistoryTokens) {
    return systemMessage ? [systemMessage, ...history] : history;
  }

  const trimmedHistory = history.slice();
  while (
    trimmedHistory.length > 2 &&
    estimateConversationTokens(trimmedHistory) > maxHistoryTokens
  ) {
    trimmedHistory.shift();
  }

  return systemMessage ? [systemMessage, ...trimmedHistory] : trimmedHistory;
}
