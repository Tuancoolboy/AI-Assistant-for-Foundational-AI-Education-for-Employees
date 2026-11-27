import { SAFETY_PREFIX, THINKING_PREFIX } from "@/lib/chat-thinking-phrases";

const THINKING_OPEN = "<thinking>";
const THINKING_CLOSE = "</thinking>";
const FINAL_OPEN = "<final>";
const FINAL_CLOSE = "</final>";

export type ChatStreamParseState = {
  /** Raw assistant text accumulated so parsing is independent of chunk boundaries. */
  buffer: string;
  safetyShown: boolean;
  thinkingText: string | null;
  answerText: string;
};

export function createChatStreamParseState(): ChatStreamParseState {
  return {
    buffer: "",
    safetyShown: false,
    thinkingText: null,
    answerText: "",
  };
}

/** Re-parse accumulated stream text so tags may be split at any byte boundary. */
export function appendChatStreamChunk(
  state: ChatStreamParseState,
  chunk: string,
): { state: ChatStreamParseState; answerChanged: boolean } {
  let source = state.buffer + chunk;
  let safetyShown = state.safetyShown;

  if (!safetyShown && source.startsWith(SAFETY_PREFIX)) {
    const newline = source.indexOf("\n");
    if (newline < 0) {
      return {
        state: { ...state, buffer: source },
        answerChanged: false,
      };
    }
    source = source.slice(newline + 1);
    safetyShown = true;
  }

  const parsed = parseAccumulatedAssistantText(source);

  return {
    state: {
      buffer: source,
      safetyShown,
      thinkingText: parsed.thinkingText,
      answerText: parsed.answerText,
    },
    answerChanged: parsed.answerText !== state.answerText,
  };
}

function parseAccumulatedAssistantText(source: string): {
  thinkingText: string | null;
  answerText: string;
} {
  const structured = parseStructuredText(source);
  if (structured) return structured;

  return parseLegacyText(source);
}

function parseStructuredText(source: string): {
  thinkingText: string | null;
  answerText: string;
} | null {
  const lower = source.toLowerCase();
  const normalizedStart = lower.trimStart();
  const thinkingOpenIndex = lower.indexOf(THINKING_OPEN);
  const finalOpenIndex = lower.indexOf(FINAL_OPEN);
  const startsWithPartialStructuredTag =
    isPartialPrefix(normalizedStart, THINKING_OPEN) ||
    isPartialPrefix(normalizedStart, FINAL_OPEN);

  if (
    thinkingOpenIndex < 0 &&
    finalOpenIndex < 0 &&
    !startsWithPartialStructuredTag
  ) {
    return null;
  }

  let thinkingText: string | null = null;
  let searchFrom = 0;

  if (thinkingOpenIndex >= 0) {
    const contentStart = thinkingOpenIndex + THINKING_OPEN.length;
    const closeIndex = lower.indexOf(THINKING_CLOSE, contentStart);
    const contentEnd = closeIndex >= 0 ? closeIndex : source.length;
    thinkingText =
      stripPartialClosingTag(source.slice(contentStart, contentEnd), THINKING_CLOSE)
        .trim() || null;
    if (closeIndex < 0) {
      return { thinkingText, answerText: "" };
    }
    searchFrom = closeIndex + THINKING_CLOSE.length;
  }

  const resolvedFinalIndex =
    finalOpenIndex >= searchFrom
      ? finalOpenIndex
      : lower.indexOf(FINAL_OPEN, searchFrom);
  if (resolvedFinalIndex < 0) {
    return { thinkingText, answerText: "" };
  }

  const finalStart = resolvedFinalIndex + FINAL_OPEN.length;
  const finalCloseIndex = lower.indexOf(FINAL_CLOSE, finalStart);
  const finalEnd = finalCloseIndex >= 0 ? finalCloseIndex : source.length;

  return {
    thinkingText,
    answerText: stripPartialClosingTag(
      source.slice(finalStart, finalEnd),
      FINAL_CLOSE,
    ).trimStart(),
  };
}

function parseLegacyText(source: string): {
  thinkingText: string | null;
  answerText: string;
} {
  const lines = source.split("\n");
  let thinkingText: string | null = null;
  const answerLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(THINKING_PREFIX)) {
      thinkingText = line.slice(THINKING_PREFIX.length).trim() || thinkingText;
      continue;
    }
    answerLines.push(line);
  }

  return {
    thinkingText,
    answerText: answerLines.join("\n"),
  };
}

function isPartialPrefix(value: string, tag: string): boolean {
  return value.length < tag.length && tag.startsWith(value);
}

function stripPartialClosingTag(value: string, closingTag: string): string {
  const lower = value.toLowerCase();
  for (let length = closingTag.length - 1; length > 0; length -= 1) {
    if (lower.endsWith(closingTag.slice(0, length))) {
      return value.slice(0, -length);
    }
  }
  return value;
}
