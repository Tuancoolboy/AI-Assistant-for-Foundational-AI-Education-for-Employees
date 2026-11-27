import { getOpenAIClient } from "@/lib/openai";
import { getSetting } from "@/lib/site-settings";

export type EvalResult = {
  score: number;
  reasoning: string;
};

export type FullEvalReport = {
  faithfulness: EvalResult;
  answerRelevancy: EvalResult;
  contextRecall: EvalResult;
};

/**
 * Faithfulness: Check if the response is fully supported by the retrieved contexts.
 */
export async function evalFaithfulness(
  response: string,
  contexts: string[],
): Promise<EvalResult> {
  const client = getOpenAIClient();
  if (!client || contexts.length === 0 || !response.trim()) {
    return { score: 1.0, reasoning: "No context or model not configured" };
  }

  const model = await getSetting("eval_model");
  const contextText = contexts.join("\n---\n");

  const systemPrompt = `You are an AI judge evaluating the faithfulness of a Chat Assistant response against the provided contexts.
Faithfulness measures if the response contains ONLY facts that are directly supported by the context. Any outside knowledge or extrapolation is unfaithful.

Return a JSON object with:
- score: float between 0.0 (completely unfaithful/hallucinated) and 1.0 (perfectly faithful to context)
- reasoning: short explanation of your scoring decision (in Vietnamese)`;

  const userContent = `[Contexts]
${contextText}

[Response]
${response}`;

  try {
    const res = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.0,
      max_tokens: 300,
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
    const score = typeof parsed.score === "number" ? parsed.score : 0.0;
    const reasoning = parsed.reasoning || "";
    return { score: Math.max(0.0, Math.min(1.0, score)), reasoning };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[evalFaithfulness] Error:", message);
    return { score: 0.0, reasoning: `Error: ${message}` };
  }
}

/**
 * Answer Relevancy: Check if the response directly addresses the user query.
 */
export async function evalAnswerRelevancy(
  query: string,
  response: string,
): Promise<EvalResult> {
  const client = getOpenAIClient();
  if (!client || !query.trim() || !response.trim()) {
    return { score: 1.0, reasoning: "Input empty or model not configured" };
  }

  const model = await getSetting("eval_model");

  const systemPrompt = `You are an AI judge evaluating the answer relevancy of a Chat Assistant response to a user query.
Answer Relevancy measures if the response directly and completely answers the query. Deduct points for generic answers, off-topic details, or redundant filler words.

Return a JSON object with:
- score: float between 0.0 (completely irrelevant) and 1.0 (completely relevant)
- reasoning: short explanation of your scoring decision (in Vietnamese)`;

  const userContent = `[Query]
${query}

[Response]
${response}`;

  try {
    const res = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.0,
      max_tokens: 300,
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
    const score = typeof parsed.score === "number" ? parsed.score : 0.0;
    const reasoning = parsed.reasoning || "";
    return { score: Math.max(0.0, Math.min(1.0, score)), reasoning };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[evalAnswerRelevancy] Error:", message);
    return { score: 0.0, reasoning: `Error: ${message}` };
  }
}

/**
 * Context Recall: Check if the retrieved contexts are sufficient to answer the user query.
 */
export async function evalContextRecall(
  query: string,
  contexts: string[],
): Promise<EvalResult> {
  const client = getOpenAIClient();
  if (!client || !query.trim() || contexts.length === 0) {
    return { score: 1.0, reasoning: "No contexts or model not configured" };
  }

  const model = await getSetting("eval_model");
  const contextText = contexts.join("\n---\n");

  const systemPrompt = `You are an AI judge evaluating the context recall of the retrieved information for a user query.
Context Recall measures if the retrieved context contains all necessary facts required to answer the query.

Return a JSON object with:
- score: float between 0.0 (contains none of the needed info) and 1.0 (contains all needed info to answer the query)
- reasoning: short explanation of your scoring decision (in Vietnamese)`;

  const userContent = `[Query]
${query}

[Contexts]
${contextText}`;

  try {
    const res = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.0,
      max_tokens: 300,
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
    const score = typeof parsed.score === "number" ? parsed.score : 0.0;
    const reasoning = parsed.reasoning || "";
    return { score: Math.max(0.0, Math.min(1.0, score)), reasoning };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[evalContextRecall] Error:", message);
    return { score: 0.0, reasoning: `Error: ${message}` };
  }
}
