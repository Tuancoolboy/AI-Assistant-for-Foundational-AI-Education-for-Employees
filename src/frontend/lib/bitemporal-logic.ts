export type TrajectoryEdge = {
  id: string;
  module_id: string;
  edge_type: "COMPLETED" | "STRUGGLED" | "MISAPPLIED";
  valid_from: string;
  system_recorded_at: string;
};

export type ReasoningTrace = {
  timestamp: string;
  trace: string;
};

export type BitemporalData = {
  edges: TrajectoryEdge[];
  reasoning: ReasoningTrace[];
};

export function calculateBitemporalState(
  data: BitemporalData | null,
  sliderValue: number,
  nowTimestamp: number = Date.now()
): {
  currentEdges: TrajectoryEdge[];
  currentReasoning: ReasoningTrace | null;
  targetTime: Date | null;
} {
  if (!data || data.edges.length === 0) {
    return { currentEdges: [], currentReasoning: null, targetTime: null };
  }

  const timestamps = data.edges.map(e => new Date(e.valid_from).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(nowTimestamp, ...timestamps);
  const timeSpan = maxTime - minTime;
  
  const targetTimestamp = minTime + (timeSpan * sliderValue) / 100;
  const targetTimeObj = new Date(targetTimestamp);
  
  const currentEdges = data.edges.filter(e => {
    const edgeTime = new Date(e.valid_from).getTime();
    return edgeTime <= targetTimestamp;
  });

  let currentReasoning = null;
  for (const r of data.reasoning) {
    if (new Date(r.timestamp).getTime() <= targetTimestamp) {
      currentReasoning = r;
    }
  }

  return { currentEdges, currentReasoning, targetTime: targetTimeObj };
}
