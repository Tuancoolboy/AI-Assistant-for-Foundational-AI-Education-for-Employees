import type { ChatGraphStateType } from "./graph-state";
import { stripLeadingAssistantGreeting } from "@/lib/chat-prompt-safety";

export async function postProcessNode(state: ChatGraphStateType) {
  const response = state.response || "";
  const cleaned = stripLeadingAssistantGreeting(response.trim());
  return { response: cleaned };
}
