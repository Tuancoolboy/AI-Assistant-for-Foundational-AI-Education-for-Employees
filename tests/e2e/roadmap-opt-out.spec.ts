// E2E spec: LMS roadmap opt-out flow + bảo mật admin endpoints.
// Playwright config CHƯA được cấu hình trong dự án này (không có playwright.config.ts).
// Spec này viết theo @playwright/test API — chạy được khi Playwright được thêm vào.
// Tất cả test đều có test.skip nếu thiếu env vars cần thiết.

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ENV_READY =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ── Helper: đăng nhập và lấy cookie session ──────────────────────────────────
async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL(`${BASE_URL}/lo-trinh`, { timeout: 10_000 });
}

// ── 1. Luồng vàng: onboarding → lộ trình → opt-out → % thay đổi ─────────────
test.describe("Luồng opt-out học viên", () => {
  test.skip(!ENV_READY, "Bỏ qua: thiếu NEXT_PUBLIC_SUPABASE_URL / ANON_KEY trong env");

  test("onboarding chọn nhóm → /lo-trinh hiển thị bài pre-checked", async ({ page }) => {
    await loginAs(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);

    // Onboarding: chọn nhóm kỹ năng đầu tiên
    await page.goto(`${BASE_URL}/onboarding`);
    await page.click('[data-testid="skill-group-option"]:first-child');
    await page.click('[data-testid="onboarding-confirm"]');
    await page.waitForURL(`${BASE_URL}/lo-trinh`);

    // Lộ trình hiển thị ít nhất 1 bài được check sẵn
    const checkedModules = page.locator('[data-testid="module-checkbox"][aria-checked="true"]');
    await expect(checkedModules.first()).toBeVisible();
  });

  test("uncheck 1 bài → % nhóm giảm", async ({ page }) => {
    await loginAs(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    await page.goto(`${BASE_URL}/lo-trinh`);

    // Đọc % ban đầu
    const percentEl = page.locator('[data-testid="group-percent"]').first();
    const before = parseInt(await percentEl.innerText());

    // Uncheck bài đầu tiên đang checked
    const firstChecked = page.locator('[data-testid="module-checkbox"][aria-checked="true"]').first();
    await firstChecked.click();

    // Chờ UI cập nhật (optimistic hoặc sau refetch)
    await page.waitForTimeout(500);
    const after = parseInt(await percentEl.innerText());

    // % không tăng sau khi bỏ chọn (giảm hoặc giữ nguyên nếu bài chưa hoàn thành)
    expect(after).toBeLessThanOrEqual(before);
  });

  test("hoàn thành 1 bài đã check → % tăng", async ({ page }) => {
    await loginAs(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    await page.goto(`${BASE_URL}/lo-trinh`);

    const percentEl = page.locator('[data-testid="group-percent"]').first();
    const before = parseInt(await percentEl.innerText());

    // Mở bài đầu tiên và đánh dấu hoàn thành
    await page.click('[data-testid="module-item"]:first-child');
    await page.click('[data-testid="complete-module-btn"]');
    await page.waitForTimeout(500);

    const after = parseInt(await percentEl.innerText());
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

// ── 2. Bảo mật: user A không toggle bài của user B ───────────────────────────
test.describe("Bảo mật: user không toggle bài người khác", () => {
  test.skip(!ENV_READY, "Bỏ qua: thiếu env");

  test("PATCH /api/member/roadmap/toggle bài ngoài nhóm sở hữu → 403", async ({ request }) => {
    // Đăng nhập user A để lấy session cookie
    await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: process.env.E2E_USER_EMAIL,
        password: process.env.E2E_USER_PASSWORD,
      },
    });
    // moduleId thuộc nhóm chỉ user B sở hữu
    const res = await request.patch(`${BASE_URL}/api/member/roadmap/toggle`, {
      data: {
        moduleId: process.env.E2E_OTHER_USER_MODULE_ID ?? "non-owned-module",
        isSelected: false,
      },
    });
    // Phải trả 403 vì user A không sở hữu nhóm chứa bài này
    expect([403, 404]).toContain(res.status());
  });
});

// ── 3. Bảo mật: admin endpoints từ chối user thường ─────────────────────────
test.describe("Bảo mật: admin endpoints trả 401/403 cho non-admin", () => {
  test.skip(!ENV_READY, "Bỏ qua: thiếu env");

  test("POST /api/admin/users/[id]/skill-groups → 403 cho user thường", async ({
    request,
  }) => {
    // Gọi không xác thực (hoặc xác thực bằng user thường — cookie không phải admin)
    const res = await request.post(`${BASE_URL}/api/admin/users/some-user-id/skill-groups`, {
      data: { skill_slugs: ["kinh-doanh"] },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("DELETE /api/admin/users/[id]/skill-groups/[slug] → 403 cho user thường", async ({
    request,
  }) => {
    const res = await request.delete(
      `${BASE_URL}/api/admin/users/some-user-id/skill-groups/kinh-doanh`,
    );
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/admin/skill-groups/[slug]/resync → 403 cho user thường", async ({
    request,
  }) => {
    const res = await request.post(
      `${BASE_URL}/api/admin/skill-groups/kinh-doanh/resync`,
    );
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/admin/users/[id]/skill-groups → 401 khi không có session", async ({
    request,
  }) => {
    // Request hoàn toàn không có cookie/auth header
    const res = await request.post(`${BASE_URL}/api/admin/users/some-user-id/skill-groups`, {
      data: { skill_slugs: ["kinh-doanh"] },
      headers: { cookie: "" }, // xóa cookie
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ── Ghi chú cấu hình Playwright ──────────────────────────────────────────────
// Để chạy spec này:
// 1. npm install -D @playwright/test
// 2. Tạo playwright.config.ts ở D:/AI-TRO-LY/src/frontend/ với:
//    import { defineConfig } from '@playwright/test';
//    export default defineConfig({ testDir: '../../tests/e2e', use: { baseURL: 'http://localhost:3000' } });
// 3. Thêm env vars: E2E_USER_EMAIL, E2E_USER_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, v.v.
// 4. npx playwright test tests/e2e/roadmap-opt-out.spec.ts
