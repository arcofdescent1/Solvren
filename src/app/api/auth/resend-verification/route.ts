import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser } from "@/lib/auth";

/** Minimum seconds between resend attempts per user (simple in-memory; use Redis in multi-instance). */
const RESEND_COOLDOWN_SEC = 60;
const cooldownUntil = new Map<string, number>();

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = authStateFromUser(user);
  if (state.isVerified) {
    return NextResponse.json(
      { error: "Email already verified" },
      { status: 400 }
    );
  }

  const now = Date.now() / 1000;
  const until = cooldownUntil.get(user.id);
  if (until != null && now < until) {
    return NextResponse.json(
      { error: "Please wait a minute before requesting another email." },
      { status: 429 }
    );
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email ?? "",
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  cooldownUntil.set(user.id, now + RESEND_COOLDOWN_SEC);
  return NextResponse.json({ ok: true });
}
