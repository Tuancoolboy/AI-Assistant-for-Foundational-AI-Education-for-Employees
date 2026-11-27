"use client";

// Nút "Lưu skill" ở trang chi tiết bài (FE-16). Học xong → lưu kỹ năng của bài vào
// bộ kỹ năng cá nhân. Chỉ real mode (Supabase). Module chưa hoàn thành → disabled.

import { useEffect, useState } from "react";
import {
  fetchSavedSkills,
  saveModuleSkills,
} from "@/lib/client-api";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export function SaveSkillButton({
  moduleId,
  disabled,
}: {
  moduleId: string;
  disabled: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  // Bài không gắn kỹ năng nào (module_skills trống) → khóa nút thay vì để bấm lại vô ích.
  const [noSkills, setNoSkills] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || disabled) return;
    let cancelled = false;
    void fetchSavedSkills()
      .then((res) => {
        if (cancelled) return;
        if (res.skills.some((s) => s.sourceModuleId === moduleId)) {
          setSaved(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [moduleId, disabled]);

  if (!isSupabaseConfigured()) return null;

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await saveModuleSkills(moduleId);
      if (res.saved && res.saved.length > 0) {
        setSaved(true);
        setMessage("Đã lưu vào bộ kỹ năng ✓");
      } else {
        setNoSkills(true);
        setMessage(res.message ?? "Bài này chưa gắn kỹ năng để lưu.");
      }
    } catch (err) {
      console.warn("[save-skill]", err);
      setMessage(
        err instanceof Error ? err.message : "Chưa lưu được kỹ năng. Thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={disabled || saving || saved || noSkills}
        className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
          saved
            ? "border-2 border-brand bg-brand-soft text-brand"
            : "border-2 border-accent bg-card text-accent hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        }`}
        title={disabled ? "Hoàn thành bài học để lưu kỹ năng" : undefined}
      >
        {saved
          ? "Đã lưu ✓"
          : saving
            ? "Đang lưu..."
            : "🔖 Lưu skill"}
      </button>
      {message && !saved && (
        <p className="text-xs text-ink-3" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
