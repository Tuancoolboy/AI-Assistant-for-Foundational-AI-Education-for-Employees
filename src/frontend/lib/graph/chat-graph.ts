import { END, StateGraph } from "@langchain/langgraph";
import { ChatGraphState } from "./graph-state";
import { retrieveContextNode } from "./retrieve-node";
import { augmentPromptNode } from "./augment-node";
import { llmRespondNode } from "./llm-node";
import { postProcessNode } from "./post-process-node";
import { evalNode } from "./eval-node";

export function compileChatGraph() {
  const workflow = new StateGraph(ChatGraphState)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addNode("retrieve", retrieveContextNode as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addNode("augment", augmentPromptNode as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addNode("llm", llmRespondNode as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addNode("post_process", postProcessNode as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addNode("eval", evalNode as any);

  workflow.addEdge("__start__", "retrieve");
  workflow.addEdge("retrieve", "augment");
  workflow.addEdge("augment", "llm");
  workflow.addEdge("llm", "post_process");
  workflow.addEdge("post_process", "eval");
  workflow.addEdge("eval", END);

  return workflow.compile();
}

export const chatAgent = compileChatGraph();
