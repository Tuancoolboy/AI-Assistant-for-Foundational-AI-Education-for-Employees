import { apiError, apiOk } from "@/lib/api-error";
import { requirePlatformAdminContext } from "@/lib/platform-admin-auth";
import {
  getSiteSettings,
  updateSiteSettings,
  validateSiteSettingsPatch,
} from "@/lib/site-settings";

export const runtime = "nodejs";

export async function GET() {
  const context = await requirePlatformAdminContext();
  if (!context) {
    return apiError(
      "FORBIDDEN",
      "Chỉ quản trị hệ thống mới có quyền truy cập cài đặt.",
    );
  }

  try {
    const settings = await getSiteSettings();
    return apiOk(settings as unknown as Record<string, unknown>);
  } catch (error: unknown) {
    console.error("[settings:get]", error);
    return apiError("INTERNAL_ERROR", "Không lấy được cài đặt hệ thống.");
  }
}

export async function PUT(request: Request) {
  const context = await requirePlatformAdminContext();
  if (!context) {
    return apiError(
      "FORBIDDEN",
      "Chỉ quản trị hệ thống mới có quyền truy cập cài đặt.",
    );
  }

  if (context.mode === "demo") {
    return apiError(
      "FORBIDDEN",
      "Demo mode chỉ cho phép xem, không cho chỉnh sửa cài đặt.",
    );
  }

  try {
    const body = await request.json();
    const { patch, errors } = validateSiteSettingsPatch(body);

    if (errors.length > 0) {
      return apiError("VALIDATION_ERROR", errors.join(" "));
    }

    if (Object.keys(patch).length === 0) {
      return apiError("VALIDATION_ERROR", "Không tìm thấy trường hợp lệ để cập nhật.");
    }

    await updateSiteSettings(patch, context.userId);
    return apiOk({ success: true, updated: Object.keys(patch) });
  } catch (error: unknown) {
    console.error("[settings:put]", error);
    return apiError(
      "INTERNAL_ERROR",
      "Không cập nhật được cài đặt hệ thống.",
    );
  }
}
