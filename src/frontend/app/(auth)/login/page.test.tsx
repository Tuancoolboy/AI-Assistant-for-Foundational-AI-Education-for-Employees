import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/components/auth-login-form", () => ({
  AuthLoginForm: ({
    nextFromQuery,
    urlError,
    urlSuccess,
    registered,
  }: {
    nextFromQuery: string | null;
    urlError: string | null;
    urlSuccess: string | null;
    registered: boolean;
  }) => (
    <div
      data-testid="auth-login-form"
      data-next={nextFromQuery ?? ""}
      data-error={urlError ?? ""}
      data-success={urlSuccess ?? ""}
      data-registered={registered ? "1" : "0"}
    />
  ),
}));

describe("/login page", () => {
  it("render tiêu đề và không còn hint demo", async () => {
    const { default: LoginPage } = await import("./page");
    const element = await LoginPage({
      searchParams: Promise.resolve({ next: "/lo-trinh", verified: "verified", registered: "1", error: "auth_callback" }),
    });
    const { container, getByTestId } = render(element);

    expect(container).toHaveTextContent("Đăng nhập");
    expect(container).not.toHaveTextContent("demo@mocan.vn");
    expect(container).not.toHaveTextContent("mocan2026");

    const form = getByTestId("auth-login-form");
    expect(form.getAttribute("data-next")).toBe("/lo-trinh");
    expect(form.getAttribute("data-error")).toBe("auth_callback");
    expect(form.getAttribute("data-success")).toBe("verified");
    expect(form.getAttribute("data-registered")).toBe("1");
  });
});

