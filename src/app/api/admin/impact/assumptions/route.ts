/**
 * Phase 5 — GET /api/admin/impact/assumptions (§18.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEffectiveAssumptions, getEffectiveAssumptionsWithMetadata } from "@/modules/impact/persistence/org-impact-assumptions.repository";

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return null;
  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (m as { org_id: string } | null)?.org_id ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const metadata = searchParams.get("metadata") === "true";

  if (metadata) {
    const assumptions = await getEffectiveAssumptionsWithMetadata(supabase, orgId);
    return NextResponse.json({ assumptions });
  }

  const assumptions = await getEffectiveAssumptions(supabase, orgId);
  const entries = Object.entries(assumptions).map(([key, value]) => ({
    key,
    value,
    valueType: typeof value,
  }));
  return NextResponse.json({ assumptions: entries });
}
