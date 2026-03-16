import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Auth state for gating: anonymous, signed-in unverified, signed-in verified.
 * Use isVerified consistently; do not scatter ad hoc checks.
 */
export type AuthState = {
  isAuthenticated: boolean;
  isVerified: boolean;
  userId: string | null;
  email: string | null;
};

/**
 * Supabase User has email_confirmed_at set when the user confirmed their email.
 * Until then, the user is unverified and must not access protected workflows.
 */
export function authStateFromUser(user: User | null): AuthState {
  if (!user) {
    return {
      isAuthenticated: false,
      isVerified: false,
      userId: null,
      email: null,
    };
  }
  const emailConfirmedAt = (user as User & { email_confirmed_at?: string | null })
    .email_confirmed_at;
  const isVerified = emailConfirmedAt != null && emailConfirmedAt !== "";

  return {
    isAuthenticated: true,
    isVerified,
    userId: user.id,
    email: user.email ?? null,
  };
}

/**
 * Use in API routes that require a verified user. Returns a 403 JSON response
 * if the current user is not verified; otherwise returns null (caller continues).
 * Call after establishing the user is signed in (e.g. after getUser()).
 */
export function requireVerifiedResponse(
  state: AuthState
): NextResponse | null {
  if (!state.isAuthenticated || !state.isVerified) {
    return NextResponse.json(
      { error: "Email verification required to use this feature." },
      { status: 403 }
    );
  }
  return null;
}

