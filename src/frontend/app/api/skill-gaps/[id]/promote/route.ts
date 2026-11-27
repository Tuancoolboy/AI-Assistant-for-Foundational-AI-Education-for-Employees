// POST promote: đẩy 1 skill_gap thành bài học DRAFT trong learning_modules,
// map skills/module_skills nếu có skill_slug, set gap='resolved' + resolved_module_id.
// Xem specs/BE-14 §4.3(b). Manager/admin only. Validate để không tạo module mồ côi.

import { apiError, apiOk } from "@/lib/api-error";
import { requireManagerContext } from "@/lib/manager-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

type PromotePayload = {
  title?: unknown;
  summary?: unknown;
  content?: unknown;
  role_id?: unknown;
  level?: unknown;
  skill_slug?: unknown;
};

// learning_modules.role_id CHECK chỉ cho 5 vai trò (KHÔNG có nhan-su).
const MODULE_ROLE_IDS = new Set([
  "kinh-doanh",
  "ke-toan",
  "marketing",
  "van-hanh",
  "khac",
]);

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return apiError("FORBIDDEN", "Tính năng cần Supabase.");
  }
  const ctx = await requireManagerContext();
  if (!ctx || ctx.session.mode !== "supabase") {
    return apiError("FORBIDDEN", "Chỉ quản lý mới thao tác được.");
  }
  const { id } = await params;

  let body: PromotePayload;
  try {
    body = (await request.json()) as PromotePayload;
  } catch {
    return apiError("VALIDATION_ERROR", "JSON không hợp lệ.");
  }

  const title = str(body.title, 200);
  const summary = str(body.summary, 500);
  const content = str(body.content, 4000);
  const roleId = str(body.role_id, 40);
  const skillSlug = str(body.skill_slug, 80);
  const level = [1, 2, 3].includes(Number(body.level)) ? Number(body.level) : 1;

  if (!title || !summary) {
    return apiError("VALIDATION_ERROR", "Cần ít nhất tiêu đề và tóm tắt.");
  }
  if (!MODULE_ROLE_IDS.has(roleId)) {
    return apiError(
      "VALIDATION_ERROR",
      "role_id không hợp lệ cho bài học (kinh-doanh|ke-toan|marketing|van-hanh|khac).",
    );
  }

  try {
    const supabase = createSupabaseServiceClient();

    // Gap phải tồn tại + thuộc org của manager (chống promote chéo org).
    const { data: gap, error: gapErr } = await supabase
      .from("skill_gaps")
      .select("id, organization_id, status, resolved_module_id")
      .eq("id", id)
      .maybeSingle();
    if (gapErr) throw gapErr;
    if (!gap) return apiError("NOT_FOUND", "Không tìm thấy gap.");
    // Strict: manager chỉ promote gap ĐÚNG org của mình. Gap null-org (user solo) hoặc
    // org khác → từ chối (tránh chèn module global xuyên org). Null-org dành cho
    // platform admin / pipeline export, không cho manager thường.
    if (gap.organization_id !== ctx.membership.organizationId) {
      return apiError("FORBIDDEN", "Gap không thuộc tổ chức của bạn.");
    }
    if (gap.resolved_module_id) {
      return apiOk({ alreadyResolved: true, moduleId: gap.resolved_module_id });
    }

    const moduleId = `gap-${slugify(title) || id.slice(0, 8)}-${id.slice(0, 6)}`;

    const { error: modErr } = await supabase.from("learning_modules").insert({
      id: moduleId,
      role_id: roleId,
      title,
      duration_min: 10,
      level,
      sort_order: 999,
      summary,
      content: content || summary,
      learnings: [],
      sections: [],
      practice_prompt: "",
    });
    if (modErr) throw modErr;

    // Map skill nếu có skill_slug khớp (global hoặc cùng org).
    if (skillSlug) {
      const { data: skill } = await supabase
        .from("skills")
        .select("id")
        .eq("slug", skillSlug)
        .or(
          `organization_id.is.null,organization_id.eq.${ctx.membership.organizationId}`,
        )
        .maybeSingle();
      if (skill?.id) {
        await supabase
          .from("module_skills")
          .insert({ module_id: moduleId, skill_id: skill.id });
      }
    }

    const { error: upErr } = await supabase
      .from("skill_gaps")
      .update({
        status: "resolved",
        resolved_module_id: moduleId,
        resolved_at: new Date().toISOString(),
        triaged_by: ctx.session.userId,
      })
      .eq("id", id);
    if (upErr) throw upErr;

    return apiOk({ moduleId, resolved: true });
  } catch (err) {
    console.error("[skill-gaps:promote]", err);
    return apiError("INTERNAL_ERROR", "Chưa promote được gap.");
  }
}
