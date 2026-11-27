"use client";

import React, { useState, useMemo } from "react";
import { ReasoningTrace } from "@/lib/bitemporal-logic";
import { Loader2, Clock, Brain, History, Sparkles, AlertCircle } from "lucide-react";
import { useBitemporalTrajectory } from "@/hooks/use-bitemporal-trajectory";

interface BitemporalTrajectoryViewProps {
  studentId: string;
  inline?: boolean;
}

export function BitemporalTrajectoryView({ studentId, inline = false }: BitemporalTrajectoryViewProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [sliderValue, setSliderValue] = useState(100);
  const [nowTimestamp] = useState(() => Date.now());

  // Lấy dữ liệu snapshot ban đầu để biết khoảng thời gian min-max
  const { data: initialData, loading: loadingInitial, error: initialError } = useBitemporalTrajectory(studentId);

  const { minTime, maxTime } = useMemo(() => {
    if (!initialData || initialData.edges.length === 0) return { minTime: 0, maxTime: 0 };
    const timestamps = initialData.edges.map(e => new Date(e.valid_from).getTime());
    return {
      minTime: Math.min(...timestamps),
      maxTime: Math.max(nowTimestamp, ...timestamps),
    };
  }, [initialData, nowTimestamp]);

  const targetTime = useMemo(() => {
    if (minTime === 0 && maxTime === 0) return null;
    if (!showHistory) return null;
    const timeSpan = maxTime - minTime;
    const currentTargetTimestamp = minTime + (timeSpan * sliderValue) / 100;
    return new Date(currentTargetTimestamp);
  }, [minTime, maxTime, sliderValue, showHistory]);

  // Fetch data theo thời điểm targetTime
  // Bỏ qua update nếu slider đang ở 100% hoặc tắt chế độ nhìn về quá khứ (dùng initialData để tránh fetch dư thừa)
  const isNow = !showHistory || (sliderValue === 100 && nowTimestamp - maxTime < 1000);
  const hookTargetTime = (!initialData || isNow) ? null : targetTime;

  const { data: updateData, loading: loadingUpdate, error: updateError } = useBitemporalTrajectory(studentId, hookTargetTime);

  const currentData = updateData || initialData;
  const error = initialError || updateError;

  // Format date-time helper
  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "---";
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loadingInitial) {
    return (
      <div className="flex justify-center items-center py-10 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
        <span className="text-sm font-medium text-ink-2">Đang tải dữ liệu quỹ đạo...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-600 flex items-start gap-2.5">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <h5 className="font-bold">Đã xảy ra lỗi</h5>
          <p className="mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  if (!initialData || initialData.edges.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-secondary/5 py-8 text-center text-ink-3 text-sm italic">
        Học viên chưa có dữ liệu quỹ đạo học tập nào được ghi nhận.
      </div>
    );
  }

  const currentEdges = currentData?.edges || [];
  
  // Find the latest reasoning trace up to targetTime
  let currentReasoning: ReasoningTrace | null = null;
  if (currentData && currentData.reasoning) {
    const targetTimestamp = targetTime ? targetTime.getTime() : nowTimestamp;
    for (const r of currentData.reasoning) {
      if (new Date(r.timestamp).getTime() <= targetTimestamp) {
        currentReasoning = r;
      }
    }
  }

  const content = (
    <div className="space-y-5">
      {/* Giải thích Bitemporal ngắn gọn */}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
        <div className="bg-sky-500/5 border border-sky-500/10 rounded-xl p-3.5 text-xs text-ink-2 space-y-1.5">
          <div className="font-bold text-ink flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-sky-600" />
            Ý nghĩa bộ nhớ hai chiều thời gian (Bitemporal Memory)
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="font-semibold text-ink block">• Thời gian học thực tế (Valid Time):</span>
              <span className="text-[11px] block mt-0.5">Khi học viên thực tế học tập và ghi nhận lỗi/kết quả trên ứng dụng.</span>
            </div>
            <div>
              <span className="font-semibold text-ink block">• Thời gian hệ thống ghi (System Time):</span>
              <span className="text-[11px] block mt-0.5">Khi AI phân tích hành vi và cập nhật cấu trúc bộ nhớ học tập trong hệ thống.</span>
            </div>
          </div>
        </div>

        {/* Nút bật/tắt nhìn về quá khứ */}
        <div className="flex flex-col sm:items-end justify-center h-full">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-ink-2">Nhìn về quá khứ</span>
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) {
                  setSliderValue(100);
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                showHistory ? "bg-brand" : "bg-line"
              }`}
              role="switch"
              aria-checked={showHistory}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  showHistory ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-ink-3 mt-1.5 text-left sm:text-right">
            {showHistory ? "Đang xem dữ liệu lịch sử tại thời điểm chọn" : "Đang hiển thị dữ liệu mới nhất"}
          </p>
        </div>
      </div>

      {/* Thanh trượt thời gian (Slider) */}
      {showHistory && (
        <div className="bg-secondary/15 rounded-xl p-4 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-ink-3 flex items-center gap-1">
              <History className="h-3.5 w-3.5" />
              Lần học đầu: {new Date(minTime).toLocaleDateString("vi-VN")}
            </span>
            <span className="text-brand bg-brand-soft/20 px-2.5 py-1 rounded-lg border border-brand/10 font-mono shadow-sm">
              Thời điểm chọn: {targetTime ? targetTime.toLocaleString("vi-VN") : new Date(maxTime).toLocaleString("vi-VN")}
            </span>
            <span className="text-ink-3">Hiện tại</span>
          </div>
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full h-2 bg-line rounded-lg appearance-none cursor-pointer accent-brand"
            />
          </div>
          <p className="text-[10px] text-ink-3 text-center">
            💡 Kéo thanh trượt để di chuyển dòng thời gian thực tế và quan sát biến động bộ nhớ của học viên.
          </p>
        </div>
      )}

      {/* Grid thông tin */}
      <div className={`grid gap-5 md:grid-cols-[1.5fr_1fr] transition-opacity duration-200 ${loadingUpdate ? 'opacity-50' : 'opacity-100'}`}>
        {/* Danh sách kỹ năng */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h4 className="font-bold text-sm text-ink flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-brand" />
              Trạng thái kỹ năng ({currentEdges.length})
            </h4>
            {loadingUpdate && (
              <span className="text-[11px] text-brand flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Đang cập nhật...
              </span>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {currentEdges.map((edge, i) => {
              // Styling status badges
              const badgeStyles = {
                COMPLETED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                STRUGGLED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                MISAPPLIED: "bg-rose-500/10 text-rose-600 border-rose-500/20",
              }[edge.edge_type] || "bg-secondary text-ink-2 border-line";

              const typeLabels = {
                COMPLETED: "Hoàn thành",
                STRUGGLED: "Gặp khó khăn",
                MISAPPLIED: "Áp dụng sai",
              }[edge.edge_type] || edge.edge_type;

              return (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-line bg-card hover:bg-secondary/5 transition-all text-xs gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink font-mono">{edge.module_id}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeStyles}`}>
                      {typeLabels}
                    </span>
                  </div>
                  <div className="flex flex-col sm:items-end text-[10px] text-ink-3 gap-0.5">
                    <span>Học thực tế: <strong className="text-ink-2 font-mono">{formatDateTime(edge.valid_from)}</strong></span>
                    <span>AI ghi nhận: <strong className="text-ink-2 font-mono">{formatDateTime(edge.system_recorded_at)}</strong></span>
                  </div>
                </div>
              );
            })}

            {currentEdges.length === 0 && (
              <div className="text-center py-6 text-ink-3 italic text-xs">
                Chưa có dữ liệu liên kết nào tại thời điểm này.
              </div>
            )}
          </div>
        </div>

        {/* Minh bạch AI (Reasoning Trace) */}
        <div className="space-y-3">
          <div className="border-b border-line pb-2">
            <h4 className="font-bold text-sm text-ink flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-amber-500" />
              Minh bạch AI (Reasoning Trace)
            </h4>
          </div>

          <div className="bg-secondary/10 border border-line/60 rounded-xl p-4 h-[calc(100%-2rem)] flex flex-col justify-between">
            {currentReasoning ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-ink-3 border-b border-line/40 pb-1.5">
                  <span>AI ghi nhận</span>
                  <span className="font-mono">{formatDateTime(currentReasoning.timestamp)}</span>
                </div>
                <blockquote className="text-xs text-ink-2 italic leading-relaxed border-l-2 border-brand/50 pl-3 py-1 font-medium">
                  &ldquo;{currentReasoning.trace}&rdquo;
                </blockquote>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-ink-3 h-full">
                <Brain className="h-8 w-8 text-ink-3/40 mb-2 stroke-[1.5]" />
                <p className="italic">Không có nhận định phân tích nào từ AI tại thời điểm này.</p>
              </div>
            )}
            <div className="text-[10px] text-ink-3/70 border-t border-line/40 pt-2 mt-4">
              * AI tự động phân tích và tạo nhật ký suy luận (reasoning trace) mỗi khi phát hiện sự cố học tập hoặc tiến độ bất thường.
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="bg-secondary/5 rounded-xl border border-line p-5 shadow-inner">
        {content}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 border-b border-line pb-3">
        <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
          <Brain className="h-5 w-5 text-brand" />
          Quỹ Đạo Học Tập Bitemporal
        </h3>
      </div>
      {content}
    </div>
  );
}
