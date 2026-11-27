"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Khung video hướng dẫn thực hành.
 *
 * Nội dung video là mockup HTML thiết kế cố định ở khổ 720×620px với các
 * tooltip đặt theo toạ độ px tuyệt đối. Nếu để iframe co theo bề rộng container
 * (< 720px) thì lớp `.screen{overflow:hidden}` bên trong sẽ cắt mất tooltip ở
 * mép phải; còn nếu ép khung 16:9 thì nội dung cao hơn box → sinh thanh cuộn.
 *
 * Giải pháp: render iframe ở đúng khổ thiết kế (720×620) rồi scale cả khung
 * theo bề rộng thực tế của container. Toàn bộ thiết kế luôn hiển thị đầy đủ,
 * không bị cắt và không có thanh cuộn.
 */

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 620;

export function PracticeVideoFrame({ videoId }: { videoId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(width / DESIGN_WIDTH);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="mt-4 rounded-xl border border-line bg-card">
      <p className="px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-3">
        Video hướng dẫn thực hành
      </p>
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-b-xl"
        style={{ height: DESIGN_HEIGHT * scale }}
      >
        <iframe
          src={`/videos/${videoId}.html`}
          title="Video hướng dẫn thực hành"
          scrolling="no"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}
