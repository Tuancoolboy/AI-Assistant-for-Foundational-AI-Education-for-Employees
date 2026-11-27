import { END, StateGraph, Annotation } from "@langchain/langgraph";
import { GraderInput } from "@/lib/agents/grader";
import { GradingResult } from "@/lib/agents/grader-types";
import { gradePracticalImages, gradeOpenTextAnswer } from "@/lib/agents/grader";

// Define the state annotation for grading graph
export const GraderGraphState = Annotation.Root({
  input: Annotation<GraderInput>,
  result: Annotation<GradingResult | null>,
  error: Annotation<string | null>,
});

// Nodes
async function validateNode(state: typeof GraderGraphState.State) {
  const input = state.input;
  if (!input) {
    return { error: "Không tìm thấy dữ liệu đầu vào để chấm." };
  }
  if (input.kind === "open-text" && (!input.answer || input.answer.trim().length < 20)) {
    return { error: "Bài tự luận quá ngắn để chấm (tối thiểu 20 ký tự)." };
  }
  if (input.kind === "practical-image" && (!input.images || input.images.length === 0)) {
    return { error: "Không có ảnh kết quả thực hành để chấm." };
  }
  return { error: null };
}

async function gradeNode(state: typeof GraderGraphState.State) {
  if (state.error) return {};

  const input = state.input;
  try {
    let result: GradingResult | null = null;
    if (input.kind === "open-text") {
      result = await gradeOpenTextAnswer(input);
    } else if (input.kind === "practical-image") {
      result = await gradePracticalImages(input);
    }

    if (!result) {
      return { error: "Mô hình AI không trả về kết quả chấm." };
    }
    return { result, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi khi chấm điểm.";
    console.error("[graderGraph][gradeNode] Error:", err);
    return { error: message };
  }
}

export function compileGraderGraph() {
  const workflow = new StateGraph(GraderGraphState)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addNode("validate", validateNode as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addNode("grade", gradeNode as any);

  workflow.addEdge("__start__", "validate");
  workflow.addEdge("validate", "grade");
  workflow.addEdge("grade", END);

  return workflow.compile();
}

export const graderGraph = compileGraderGraph();
