/**
 * Phase 4 — POST /api/admin/integrations/dead-letters/:id/ignore (§18.6).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDeadLetter } from "@/modules/integrations/reliability/repositories/integration-dead-letters.repository";
import { markDeadLetterIgnored } from "@/modules/integrations/reliability/services/dead-letter.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dl } = await getDeadLetter(supabase, id);
  if (!dl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (dl.status !== "OPEN") return NextResponse.json({ error: "Already resolved" }, { status: 400 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", dl.org_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body.reason) return NextResponse.json({ error: "reason required" }, { status: 400 });

  const { error } = await markDeadLetterIgnored(supabase, id, body.reason);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: "IGNORED" });
}
