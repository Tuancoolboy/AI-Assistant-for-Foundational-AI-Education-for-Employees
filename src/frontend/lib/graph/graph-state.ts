import { Annotation } from "@langchain/langgraph";

export const ChatGraphState = Annotation.Root({
  query: Annotation<string>,
  userId: Annotation<string>,
  roleId: Annotation<string>,
  systemPrompt: Annotation<string>,
  retrievedContexts: Annotation<string[]>,
  augmentedPrompt: Annotation<string>,
  response: Annotation<string>,
  memoryContext: Annotation<string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: Annotation<any[]>,
  metadata: Annotation<Record<string, unknown>>,
  evaluationScore: Annotation<number | null>,
});

export type ChatGraphStateType = typeof ChatGraphState.State;
