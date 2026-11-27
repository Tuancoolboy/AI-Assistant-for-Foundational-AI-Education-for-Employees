"use client";

import { memo, useMemo } from "react";
import { ChatPromptBlock } from "@/components/chat-prompt-block";
import { splitChatContentBlocks } from "@/lib/chat-content-blocks";
import { parseChatInlineSegments } from "@/lib/module-lesson-links";

type MessageTone = "assistant" | "user";
type Variant = "compact" | "full";

export const ChatRichContent = memo(function ChatRichContent({
  text,
  tone,
  variant = "full",
}: {
  text: string;
  tone: MessageTone;
  variant?: Variant;
}) {
  const blocks = useMemo(() => splitChatContentBlocks(text), [text]);

  return (
    <div className="space-y-1.5">
      {blocks.map((block, blockIdx) => {
        if (block.type === "code") {
          return (
            <ChatPromptBlock
              key={`code-${blockIdx}`}
              code={block.content}
              variant={variant}
            />
          );
        }

        const content =
          tone === "assistant"
            ? normalizeAssistantRichText(block.content)
            : block.content;
        const lines = content.split("\n");
        return (
          <div key={`text-${blockIdx}`} className="space-y-3">
            {renderStructuredLines(lines, tone, variant)}
          </div>
        );
      })}
    </div>
  );
});

function normalizeAssistantRichText(text: string): string {
  return text
    .replace(/([^\n])\s*(#{1,3}\s+)/g, "$1\n\n$2")
    .replace(/([:.!?])\s+([-*]\s+)/g, "$1\n$2")
    .replace(/([:.!?])\s+(\d+\.\s+)/g, "$1\n$2")
    .replace(/([.!?])(?=\p{Lu})/gu, "$1 ");
}

function renderStructuredLines(
  lines: string[],
  tone: MessageTone,
  variant: Variant,
) {
  const nodes: React.ReactNode[] = [];
  let idx = 0;
  const baseTextClass = tone === "user" ? "text-brand-foreground" : "text-ink";
  const mutedTextClass =
    tone === "user" ? "text-brand-foreground/88" : "text-ink-2";
  const markerClass =
    tone === "user" ? "marker:text-brand-foreground/75" : "marker:text-brand";

  while (idx < lines.length) {
    const line = lines[idx] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      idx += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const headingClass =
        level === 1
          ? `text-xl font-bold tracking-tight ${baseTextClass}`
          : level === 2
            ? `text-lg font-bold tracking-tight ${baseTextClass}`
            : `text-base font-bold ${baseTextClass}`;
      nodes.push(
        <div key={`heading-${idx}`} className={headingClass}>
          {renderInlineLine(heading[2] ?? "", tone)}
        </div>,
      );
      idx += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      nodes.push(
        <blockquote
          key={`quote-${idx}`}
          className={`border-l-4 px-4 py-2 ${
            tone === "user"
              ? "border-brand-foreground/30 bg-white/8 text-brand-foreground/90"
              : "border-brand/25 bg-secondary/30 text-ink-2"
          }`}
        >
          {renderInlineLine(trimmed.replace(/^>\s?/, ""), tone)}
        </blockquote>,
      );
      idx += 1;
      continue;
    }

    if (isPipeTableStart(lines, idx)) {
      const parsed = collectPipeTable(lines, idx);
      nodes.push(
        <div
          key={`table-${idx}`}
          className="max-w-full overflow-x-auto rounded-2xl border border-line bg-card"
        >
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className={tone === "user" ? "bg-white/10" : "bg-secondary/70"}>
              <tr>
                {parsed.headers.map((header, cellIdx) => (
                  <th
                    key={`th-${cellIdx}`}
                    scope="col"
                    className={`border-b border-line px-3 py-2 font-semibold leading-relaxed ${baseTextClass}`}
                  >
                    {renderInlineLine(header, tone)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, rowIdx) => (
                <tr
                  key={`tr-${rowIdx}`}
                  className={rowIdx % 2 === 0 ? "bg-transparent" : "bg-secondary/25"}
                >
                  {parsed.headers.map((_, cellIdx) => (
                    <td
                      key={`td-${rowIdx}-${cellIdx}`}
                      className={`border-t border-line/70 px-3 py-2 align-top leading-relaxed ${mutedTextClass}`}
                    >
                      {renderInlineLine(row[cellIdx] ?? "", tone)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      idx = parsed.nextIdx;
      continue;
    }

    if (isBulletLine(trimmed)) {
      const items: string[] = [];
      while (idx < lines.length) {
        const current = lines[idx]?.trim() ?? "";
        if (!isBulletLine(current)) break;
        items.push(current.replace(/^[-*]\s+/, ""));
        idx += 1;
      }

      nodes.push(
        <ul
          key={`ul-${idx}`}
          className={`space-y-2 ${variant === "full" ? "pl-5" : "pl-4"} list-disc ${markerClass}`}
        >
          {items.map((item, itemIdx) => (
            <li
              key={`ul-item-${idx}-${itemIdx}`}
              className={`leading-relaxed ${baseTextClass}`}
            >
              {renderInlineLine(item, tone)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (isOrderedLine(trimmed)) {
      const items: string[] = [];
      while (idx < lines.length) {
        const current = lines[idx]?.trim() ?? "";
        if (!current) {
          const nextOrderedIdx = findNextOrderedLineIndex(lines, idx + 1);
          if (nextOrderedIdx < 0) break;
          idx = nextOrderedIdx;
          continue;
        }
        if (!isOrderedLine(current)) break;
        items.push(current.replace(/^\d+\.\s+/, ""));
        idx += 1;
      }

      nodes.push(
        <ol
          key={`ol-${idx}`}
          className={`space-y-2 ${variant === "full" ? "pl-5" : "pl-4"} list-decimal marker:font-semibold ${markerClass}`}
        >
          {items.map((item, itemIdx) => (
            <li
              key={`ol-item-${idx}-${itemIdx}`}
              className={`leading-relaxed ${baseTextClass}`}
            >
              {renderInlineLine(item, tone)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines = [trimmed];
    idx += 1;
    while (idx < lines.length) {
      const current = lines[idx]?.trim() ?? "";
      if (
        !current ||
        current.startsWith(">") ||
        isPipeTableStart(lines, idx) ||
        isBulletLine(current) ||
        isOrderedLine(current) ||
        /^(#{1,3})\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      idx += 1;
    }

    nodes.push(
      <p
        key={`p-${idx}`}
        className={`whitespace-pre-wrap leading-relaxed ${mutedTextClass}`}
      >
        {renderInlineLine(paragraphLines.join(" "), tone)}
      </p>,
    );
  }

  return nodes;
}

function isBulletLine(text: string) {
  return /^[-*]\s+/.test(text);
}

function isOrderedLine(text: string) {
  return /^\d+\.\s+/.test(text);
}

function isPipeTableStart(lines: string[], idx: number): boolean {
  const header = lines[idx]?.trim() ?? "";
  const separator = lines[idx + 1]?.trim() ?? "";
  return isPipeTableRow(header) && isPipeTableSeparator(separator);
}

function isPipeTableRow(text: string): boolean {
  if (!text.includes("|")) return false;
  return splitPipeCells(text).length >= 2;
}

function isPipeTableSeparator(text: string): boolean {
  const cells = splitPipeCells(text);
  return (
    cells.length >= 2 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  );
}

function splitPipeCells(text: string): string[] {
  return text
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function collectPipeTable(lines: string[], startIdx: number) {
  const headers = splitPipeCells(lines[startIdx] ?? "");
  const rows: string[][] = [];
  let idx = startIdx + 2;

  while (idx < lines.length) {
    const current = lines[idx]?.trim() ?? "";
    if (!isPipeTableRow(current) || isPipeTableSeparator(current)) break;
    rows.push(splitPipeCells(current));
    idx += 1;
  }

  return { headers, rows, nextIdx: idx };
}

function findNextOrderedLineIndex(lines: string[], startIdx: number) {
  let idx = startIdx;
  while (idx < lines.length) {
    const current = lines[idx]?.trim() ?? "";
    if (!current) {
      idx += 1;
      continue;
    }
    return isOrderedLine(current) ? idx : -1;
  }
  return -1;
}

function renderInlineLine(line: string, tone: MessageTone) {
  const linkClassName =
    tone === "user"
      ? "font-semibold underline decoration-brand-foreground/50 underline-offset-2 hover:decoration-brand-foreground"
      : "font-semibold text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand";

  return parseChatInlineSegments(line).map((segment, pIdx) => {
    if (segment.kind === "bold") {
      return (
        <strong key={pIdx} className="font-semibold">
          {segment.value}
        </strong>
      );
    }
    if (segment.kind === "link") {
      return (
        <a
          key={pIdx}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {segment.label}
        </a>
      );
    }
    return <span key={pIdx}>{segment.value}</span>;
  });
}
