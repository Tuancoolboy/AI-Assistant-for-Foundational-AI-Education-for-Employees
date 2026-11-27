import { describe, it, expect } from "vitest";
import { compileGraderGraph } from "./grader-graph";

describe("compileGraderGraph", () => {
  it("should compile the grader workflow graph successfully", () => {
    const graph = compileGraderGraph();
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe("function");
  });
});
