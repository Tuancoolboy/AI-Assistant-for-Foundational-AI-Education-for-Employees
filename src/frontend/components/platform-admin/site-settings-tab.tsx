"use client";

import { useEffect, useState } from "react";
import { 
  Brain, 
  Cpu, 
  Gauge, 
  Save, 
  RotateCcw,
  AlertTriangle 
} from "lucide-react";
import { PanelCard, SectionTitle, ToastBanner } from "./platform-admin-console-ui";
import { cn } from "@/lib/utils";

interface SiteSettings {
  enable_chat_eval: boolean;
  eval_model: string;
  faithfulness_alert_threshold: number;
  chat_model: string;
  synthesis_model: string;
  grader_model: string;
  path_agent_model: string;
  daily_message_limit: number;
  max_context_tokens: number;
  max_history_messages: number;
}

const MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Tiết kiệm, nhanh)" },
  { value: "gpt-4o", label: "GPT-4o (Mạnh mẽ, chuẩn xác)" },
  { value: "gpt-4o-turbo", label: "GPT-4o Turbo (Mạnh mẽ nhất)" },
  { value: "o1-mini", label: "o1-mini (Suy luận cao)" }
];

export function SiteSettingsTab() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<Partial<SiteSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch("/api/van-hanh/settings");
        const body = await res.json();
        
        if (res.ok && body.ok) {
          // Exclude metadata fields from return
          const cleanSettings: SiteSettings = {
            enable_chat_eval: body.enable_chat_eval ?? false,
            eval_model: body.eval_model ?? "gpt-4o-mini",
            faithfulness_alert_threshold: body.faithfulness_alert_threshold ?? 0.7,
            chat_model: body.chat_model ?? "gpt-4o",
            synthesis_model: body.synthesis_model ?? "gpt-4o",
            grader_model: body.grader_model ?? "gpt-4o",
            path_agent_model: body.path_agent_model ?? "gpt-4o-mini",
            daily_message_limit: body.daily_message_limit ?? 30,
            max_context_tokens: body.max_context_tokens ?? 8000,
            max_history_messages: body.max_history_messages ?? 10,
          };
          setSettings(cleanSettings);
        } else if (res.status === 403 && body.error?.message?.includes("Demo mode")) {
          // Handle case if route returns demo notice or fails
          setToast({ kind: "error", message: body.error.message });
        } else {
          setToast({ kind: "error", message: body.error?.message || "Không thể tải cài đặt hệ thống." });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        setToast({ kind: "error", message: "Lỗi mạng hoặc kết nối máy chủ." });
      } finally {
        // Check if demo mode is enabled (usually based on cookie or check console path)
        const matchesDemo = typeof document !== "undefined" && (
          document.cookie.includes("DEMO_PLATFORM_ADMIN=true") || 
          window.location.hostname.includes("demo") || 
          window.location.hostname.includes("vercel.app")
        );
        setIsDemoMode(matchesDemo);
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  // Warning when leaving with unsaved changes
  const hasChanges = Object.keys(draft).length > 0;
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn rời đi?";
        return e.returnValue;
      }
    };

    const handleAnchorClick = (e: MouseEvent) => {
      if (!hasChanges) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Check if it is an internal link navigating away from current page
      const isInternal = href.startsWith("/") || href.startsWith(window.location.origin);
      const isCaiDat = href.includes("cai-dat");

      if (isInternal && !isCaiDat) {
        const confirmLeave = window.confirm(
          "Bạn có thay đổi chưa lưu trong Cài đặt hệ thống. Bạn có chắc chắn muốn rời đi?"
        );
        if (!confirmLeave) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleAnchorClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleAnchorClick, true);
    };
  }, [hasChanges]);

  if (loading) {
    return (
      <div className="mt-8 space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-secondary rounded-lg" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 bg-card rounded-2xl border border-line" />
          <div className="h-64 bg-card rounded-2xl border border-line" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line bg-secondary/10 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
        <p className="mt-2 font-bold text-ink text-base">Không có dữ liệu cấu hình</p>
        <p className="mt-1 text-sm text-ink-2">Không thể đọc thông số cấu hình từ máy chủ.</p>
      </div>
    );
  }

  const handleUpdate = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // If value is reverted back to original, remove from draft
      if (settings[key] === value) {
        delete next[key];
      }
      return next;
    });
  };

  const getValue = <K extends keyof SiteSettings>(key: K): SiteSettings[K] => {
    return (draft[key] !== undefined ? draft[key] : settings[key]) as SiteSettings[K];
  };

  const handleCancel = () => {
    setDraft({});
    setToast({ kind: "success", message: "Đã hủy các thay đổi chưa lưu." });
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    try {
      setSaving(true);
      const res = await fetch("/api/van-hanh/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json();

      if (res.ok && body.ok) {
        setSettings((prev) => (prev ? { ...prev, ...draft } : null));
        setDraft({});
        setToast({ kind: "success", message: "Đã lưu cài đặt hệ thống thành công." });
      } else {
        setToast({ kind: "error", message: body.error?.message || "Không thể cập nhật cài đặt." });
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      setToast({ kind: "error", message: "Lỗi mạng, vui lòng thử lại sau." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionTitle 
          title="Cài đặt hệ thống" 
          subtitle="Quản lý tham số AI, cấu hình model LLM và giới hạn sử dụng toàn hệ thống" 
        />
        
        <div className="flex items-center gap-4">
          {hasChanges && (
            <span className="text-xs text-amber-600 font-semibold animate-pulse hidden sm:inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Thay đổi chưa lưu
            </span>
          )}
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand transition duration-200 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
              >
                <RotateCcw className="h-4 w-4" />
                Hủy
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold text-white transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none",
                hasChanges && !saving ? "bg-brand hover:bg-brand/90 shadow-sm" : "bg-secondary text-ink-3 border border-line"
              )}
            >
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu…" : "Lưu cài đặt"}
            </button>
          </div>
        </div>
      </div>

      {isDemoMode && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Hệ thống đang chạy ở chế độ Demo. Bạn có thể xem các cài đặt nhưng không thể lưu thay đổi vào cơ sở dữ liệu.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* SECTION 1: AI Evaluation */}
        <PanelCard className="p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2 border-b border-line/40 pb-4">
              <Brain className="h-5 w-5 text-brand" />
              Đánh giá RAGAS & Kiểm tra AI
            </h3>

            {/* Enable Chat Eval Toggle */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <label htmlFor="enable_chat_eval" className="text-sm font-bold text-ink">
                  Đánh giá tự động
                </label>
                <p className="text-xs text-ink-2">
                  Tự động chấm điểm độ trung thực (Faithfulness) và mức liên quan (Relevancy) sau mỗi cuộc trò chuyện.
                </p>
              </div>
              <button
                id="enable_chat_eval"
                type="button"
                role="switch"
                aria-checked={getValue("enable_chat_eval")}
                aria-label="Kích hoạt tự động đánh giá RAGAS sau mỗi tin nhắn"
                onClick={() => handleUpdate("enable_chat_eval", !getValue("enable_chat_eval"))}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                  getValue("enable_chat_eval") ? "bg-brand" : "bg-secondary"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    getValue("enable_chat_eval") ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Eval Model Select */}
            <div className="space-y-2">
              <label htmlFor="eval_model" className="text-sm font-bold text-ink">
                Model LLM đánh giá RAGAS
              </label>
              <select
                id="eval_model"
                value={getValue("eval_model")}
                onChange={(e) => handleUpdate("eval_model", e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Alert Threshold Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="faithfulness_alert_threshold" className="text-sm font-bold text-ink">
                  Ngưỡng cảnh báo độ trung thực (Faithfulness)
                </label>
                <span className="text-sm font-mono font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-md">
                  {getValue("faithfulness_alert_threshold").toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-ink-2">
                Các câu trả lời có độ trung thực thấp hơn ngưỡng này sẽ được đánh dấu cảnh báo trên dashboard.
              </p>
              <div className="flex items-center gap-4">
                <input
                  id="faithfulness_alert_threshold"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={getValue("faithfulness_alert_threshold")}
                  onChange={(e) => handleUpdate("faithfulness_alert_threshold", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>
            </div>
          </div>
        </PanelCard>

        {/* SECTION 3: Rate Limits & Quotas */}
        <PanelCard className="p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2 border-b border-line/40 pb-4">
              <Gauge className="h-5 w-5 text-brand" />
              Hạn mức & Giới hạn sử dụng
            </h3>

            {/* Daily limit */}
            <div className="space-y-2">
              <label htmlFor="daily_message_limit" className="text-sm font-bold text-ink">
                Hạn mức chat (tin nhắn / người / ngày)
              </label>
              <input
                id="daily_message_limit"
                type="number"
                min="0"
                max="1000"
                value={getValue("daily_message_limit")}
                onChange={(e) => handleUpdate("daily_message_limit", parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              />
              <p className="text-xs text-ink-2">
                Số lượng tin nhắn tối đa mà mỗi nhân viên được phép gửi cho Trợ lý trong 24 giờ.
              </p>
            </div>

            {/* Max context tokens */}
            <div className="space-y-2">
              <label htmlFor="max_context_tokens" className="text-sm font-bold text-ink">
                Giới hạn token ngữ cảnh tối đa
              </label>
              <input
                id="max_context_tokens"
                type="number"
                min="1000"
                max="64000"
                step="500"
                value={getValue("max_context_tokens")}
                onChange={(e) => handleUpdate("max_context_tokens", parseInt(e.target.value, 10) || 1000)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              />
              <p className="text-xs text-ink-2">
                Số lượng token tối đa gửi lên mô hình để tránh tràn cửa sổ và kiểm soát chi phí.
              </p>
            </div>

            {/* Max history messages */}
            <div className="space-y-2">
              <label htmlFor="max_history_messages" className="text-sm font-bold text-ink">
                Số lượng tin nhắn hội thoại đính kèm
              </label>
              <input
                id="max_history_messages"
                type="number"
                min="1"
                max="50"
                value={getValue("max_history_messages")}
                onChange={(e) => handleUpdate("max_history_messages", parseInt(e.target.value, 10) || 1)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              />
              <p className="text-xs text-ink-2">
                Số lượt hội thoại cũ gần nhất được gửi kèm để làm ngữ cảnh nhớ cho Agent.
              </p>
            </div>
          </div>
        </PanelCard>
      </div>

      {/* SECTION 2: Agent Models */}
      <PanelCard className="p-6">
        <div className="space-y-6">
          <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2 border-b border-line/40 pb-4">
            <Cpu className="h-5 w-5 text-brand" />
            Cấu hình mô hình cho các Agent độc lập
          </h3>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Chat agent */}
            <div className="space-y-2">
              <label htmlFor="chat_model" className="text-sm font-bold text-ink">
                Mô hình Trợ lý chat (Chat Agent)
              </label>
              <select
                id="chat_model"
                value={getValue("chat_model")}
                onChange={(e) => handleUpdate("chat_model", e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-2">Mô hình phản hồi chính khi nhân viên chat đặt câu hỏi.</p>
            </div>

            {/* Synthesis model */}
            <div className="space-y-2">
              <label htmlFor="synthesis_model" className="text-sm font-bold text-ink">
                Mô hình tổng hợp hội thoại (Synthesis Agent)
              </label>
              <select
                id="synthesis_model"
                value={getValue("synthesis_model")}
                onChange={(e) => handleUpdate("synthesis_model", e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-2">Mô hình thực hiện tóm tắt các cuộc hội thoại dài và phản tư học tập.</p>
            </div>

            {/* Grader model */}
            <div className="space-y-2">
              <label htmlFor="grader_model" className="text-sm font-bold text-ink">
                Mô hình chấm điểm tự luận (Grader Agent)
              </label>
              <select
                id="grader_model"
                value={getValue("grader_model")}
                onChange={(e) => handleUpdate("grader_model", e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-2">Mô hình phân tích ảnh chụp/câu trả lời thực hành và đánh giá theo Rubric.</p>
            </div>

            {/* Path agent model */}
            <div className="space-y-2">
              <label htmlFor="path_agent_model" className="text-sm font-bold text-ink">
                Mô hình sinh lộ trình học tập (Path Agent)
              </label>
              <select
                id="path_agent_model"
                value={getValue("path_agent_model")}
                onChange={(e) => handleUpdate("path_agent_model", e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-2">Mô hình phân tích vướng mắc nhân sự để gợi ý lộ trình kỹ năng phù hợp.</p>
            </div>
          </div>
        </div>
      </PanelCard>

      {toast && (
        <ToastBanner 
          kind={toast.kind} 
          message={toast.message} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
