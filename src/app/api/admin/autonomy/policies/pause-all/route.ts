/**
 * Phase 8 — POST /api/admin/autonomy/policies/pause-all.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { setAutomationPaused } from "@/modules/autonomy/persistence/policies.repository";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  let body: { pause: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { error } = await setAutomationPaused(
    supabase,
    membership.org_id,
    body.pause ?? true,
    userRes.user.id,
    body.reason
  );

  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  return NextResponse.json({ ok: true, paused: body.pause ?? true });
}
