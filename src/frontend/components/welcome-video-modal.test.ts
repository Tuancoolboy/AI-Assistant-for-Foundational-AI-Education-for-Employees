import { describe, expect, it } from "vitest";
import { shouldShowWelcomeVideoOnPath } from "./welcome-video-modal";

describe("shouldShowWelcomeVideoOnPath", () => {
  it("does not show the welcome video on learning-path routes", () => {
    expect(shouldShowWelcomeVideoOnPath("/lo-trinh")).toBe(false);
    expect(shouldShowWelcomeVideoOnPath("/lo-trinh/ke-toan-m1")).toBe(false);
  });

  it("does not show the welcome video on chat evidence routes", () => {
    expect(shouldShowWelcomeVideoOnPath("/tro-ly")).toBe(false);
  });

  it("does not show the welcome video on mentor QA proof routes", () => {
    expect(shouldShowWelcomeVideoOnPath("/tien-bo")).toBe(false);
    expect(shouldShowWelcomeVideoOnPath("/bo-ky-nang")).toBe(false);
    expect(shouldShowWelcomeVideoOnPath("/topic-cau-hoi")).toBe(false);
    expect(shouldShowWelcomeVideoOnPath("/kiem-tra/ke-toan")).toBe(false);
    expect(shouldShowWelcomeVideoOnPath("/bang-xep-hang")).toBe(false);
    expect(shouldShowWelcomeVideoOnPath("/tai-khoan")).toBe(false);
  });

  it("keeps the welcome video allowlisted only for onboarding", () => {
    expect(shouldShowWelcomeVideoOnPath("/onboarding")).toBe(true);
    expect(shouldShowWelcomeVideoOnPath("/onboarding/ket-qua")).toBe(true);
    expect(shouldShowWelcomeVideoOnPath(null)).toBe(false);
  });
});
