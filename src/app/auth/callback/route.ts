import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Supabase email confirmation callback. The confirmation link in the verification
 * email should point to this route with token_hash and type (e.g. signup or email).
 * Configure in Supabase: Authentication → URL Configuration → Redirect URLs and
 * email template to use: {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type={{ .TokenType }}
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/auth/verify-error", request.url));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash,
  });

  if (error) {
    if (type === "recovery") {
      return NextResponse.redirect(new URL("/auth/reset-password?error=invalid", request.url));
    }
    return NextResponse.redirect(new URL("/auth/verify-error", request.url));
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/auth/reset-password", request.url));
  }

  return NextResponse.redirect(new URL("/auth/verified", request.url));
}
