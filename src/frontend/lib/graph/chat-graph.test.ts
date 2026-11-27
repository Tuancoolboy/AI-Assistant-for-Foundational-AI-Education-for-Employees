import { describe, it, expect } from "vitest";
import { compileChatGraph } from "./chat-graph";

describe("compileChatGraph", () => {
  it("should compile the workflow graph successfully", () => {
    const graph = compileChatGraph();
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe("function");
  });
});
