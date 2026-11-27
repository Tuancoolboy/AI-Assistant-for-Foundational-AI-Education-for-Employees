// Renderer markdown nhẹ (không thêm thư viện) cho khối "Hướng dẫn chi tiết" của
// bài học vai trò vibe-code. Hỗ trợ tập con markdown dùng trong giáo trình:
// code fence, blockquote, bullet/numbered list (có lồng cấp), **đậm**, `code`,
// [link](url) và heading. Đủ để hiển thị trọn nội dung course.json một cách dễ đọc.

import { Fragment, type ReactNode } from "react";

const INLINE_RE = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

// Nội dung là giáo trình tĩnh do team biên soạn (course.json), KHÔNG phải output
// AI/user. Dù vậy vẫn chặn protocol nguy hiểm (javascript:, data:) làm defense-in-depth;
// chỉ cho phép link tài liệu http(s), đường dẫn nội bộ, mailto, anchor. Không hợp lệ
// → render plain text thay vì <a>.
function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|\/|#|mailto:)/i.test(href.trim());
}

function renderInline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={`${key}-b${i}`}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={`${key}-c${i}`}
          className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[0.85em] text-ink"
        >
          {m[3]}
        </code>,
      );
    } else if (m[4] !== undefined) {
      // href không an toàn → giữ nguyên text "[nhãn](url)" thay vì tạo link.
      if (isSafeHref(m[5])) {
        nodes.push(
          <a
            key={`${key}-a${i}`}
            href={m[5]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-2 hover:text-brand-2 break-words"
          >
            {m[4]}
          </a>,
        );
      } else {
        nodes.push(m[0]);
      }
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBlocks(md: string): ReactNode[] {
  const lines = md.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence: ```lang ... ```
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // bỏ qua fence đóng
      blocks.push(
        <pre
          key={`k${k++}`}
          className="my-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-line bg-secondary/50 p-3 font-mono text-xs leading-relaxed text-ink-2"
        >
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }

    // Blockquote: nhóm các dòng "> ..."
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`k${k++}`}
          className="my-2 rounded-xl border-l-4 border-brand/40 bg-brand-soft px-3 py-2 text-sm leading-relaxed text-ink-2"
        >
          {renderInline(buf.join(" "), `k${k}`)}
        </blockquote>,
      );
      continue;
    }

    // Heading: # ... → in đậm
    const heading = line.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      blocks.push(
        <p key={`k${k++}`} className="mt-3 font-display text-base font-bold text-ink">
          {renderInline(heading[2], `k${k}`)}
        </p>,
      );
      i += 1;
      continue;
    }

    // List item (bullet hoặc numbered), hỗ trợ lồng cấp theo thụt lề
    const li = line.match(/^(\s*)([-*]|\d+[.)])\s+(.*)/);
    if (li) {
      const indent = Math.floor(li[1].replace(/\t/g, "  ").length / 2);
      const ordered = /\d/.test(li[2]);
      blocks.push(
        <div
          key={`k${k++}`}
          className="flex gap-2 text-sm leading-relaxed text-ink-2"
          style={{ paddingLeft: indent * 16 }}
        >
          <span className="select-none text-ink-3">{ordered ? li[2] : "•"}</span>
          <span className="min-w-0">{renderInline(li[3], `k${k}`)}</span>
        </div>,
      );
      i += 1;
      continue;
    }

    // Dòng trống → bỏ qua (khoảng cách do margin của block lo)
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Đoạn văn thường
    blocks.push(
      <p key={`k${k++}`} className="text-sm leading-relaxed text-ink-2">
        {renderInline(line, `k${k}`)}
      </p>,
    );
    i += 1;
  }

  return blocks;
}

export function LessonDetailMarkdown({
  markdown,
  title = "📖 Hướng dẫn chi tiết (đầy đủ)",
}: {
  markdown: string;
  title?: string;
}) {
  return (
    <details className="mt-6 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <summary className="cursor-pointer select-none font-display text-base font-bold text-ink">
        {title}
      </summary>
      <div className="mt-4 space-y-1.5">
        <Fragment>{renderBlocks(markdown)}</Fragment>
      </div>
    </details>
  );
}
