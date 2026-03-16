import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";

/**
 * Create organization for authenticated, verified user.
 * Uses service role to bypass RLS (avoids "new row violates row-level security policy").
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;
  const userId = userRes.user.id;

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name, created_by: userId })
    .select()
    .single();

  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }

  const { error: memErr } = await admin
    .from("organization_members")
    .insert({ org_id: org.id, user_id: userId, role: "owner" });

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, org });
}
