import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/post-auth-redirect";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/public-env";
import { logUserActivity } from "@/lib/audit-log";

// Xử lý link xác nhận email / Google OAuth (PKCE) từ Supabase → session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next")) ?? "/onboarding";

  // Supabase forwards provider errors as ?error=...&error_description=... (no code).
  const providerError =
    searchParams.get("error") ?? searchParams.get("error_code");
  const providerErrorDesc = searchParams.get("error_description");
  if (providerError || providerErrorDesc) {
    console.error(
      "[auth/callback] provider error:",
      providerError,
      providerErrorDesc,
    );
    const verified = new URL("/verified", origin);
    verified.searchParams.set("status", "error");
    if (providerError) verified.searchParams.set("code", providerError);
    if (providerErrorDesc)
      verified.searchParams.set("description", providerErrorDesc);
    return NextResponse.redirect(verified);
  }

  const supabaseUrl = getSupabaseUrl();
  const supabasePublicKey = getSupabasePublicKey();

  if (!code || !supabaseUrl || !supabasePublicKey) {
    const verified = new URL("/verified", origin);
    verified.searchParams.set("status", "error");
    verified.searchParams.set(
      "description",
      !code
        ? "Missing authorization code from Supabase callback"
        : "Supabase environment not configured",
    );
    return NextResponse.redirect(verified);
  }

  const redirectUrl = new URL(next, origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback]", error.message);
    const verified = new URL("/verified", origin);
    verified.searchParams.set("status", "error");
    if (error.code) verified.searchParams.set("code", error.code);
    verified.searchParams.set("description", error.message);
    return NextResponse.redirect(verified);
  }

  if (data.user) {
    void logUserActivity(data.user.id, "auth.login", {
      provider: "google", // assumed usually
    });
  }

  return response;
}
