/**
 * Phase 4 — GET /api/admin/integrations/dead-letters (§18.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listDeadLetters } from "@/modules/integrations/reliability/repositories/integration-dead-letters.repository";

export async function GET(req: NextRequest) {
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

  const orgId = (membership as { org_id: string }).org_id;
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? undefined;
  const status = searchParams.get("status") ?? "OPEN";
  const type = searchParams.get("type") ?? undefined;

  const { data, error } = await listDeadLetters(supabase, orgId, {
    provider,
    status,
    type,
  }, 50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deadLetters: data ?? [] });
}
