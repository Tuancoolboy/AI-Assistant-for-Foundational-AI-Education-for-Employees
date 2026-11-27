import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isManagerUser } from "@/lib/manager-auth";
import { SkillGapsAdminBoard } from "@/components/skill-gaps-admin-board";

export const metadata: Metadata = {
  title: "Skill Gaps · Quản lý · AI Trợ Lý",
};

export default async function QuanLySkillGapsPage() {
  if (!(await isManagerUser())) {
    redirect("/lo-trinh");
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          Skill Gaps
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Những chủ đề người dùng hỏi mà AI chưa có bài học phù hợp — sắp xếp theo số lần hỏi.
          Phân loại, bỏ qua, hoặc promote thành module mới.
        </p>
      </div>
      <SkillGapsAdminBoard />
    </div>
  );
}
