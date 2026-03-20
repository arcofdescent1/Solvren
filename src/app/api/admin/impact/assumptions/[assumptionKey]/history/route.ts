/**
 * Phase 5 — GET /api/admin/impact/assumptions/:assumptionKey/history (§18.2).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listAssumptionHistory } from "@/modules/impact/persistence/org-impact-assumptions.repository";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assumptionKey: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assumptionKey } = await params;
  const { data, error } = await listAssumptionHistory(supabase, orgId, assumptionKey);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    history: data.map((r) => ({
      id: r.id,
      assumptionKey: r.assumption_key,
      displayName: r.display_name,
      valueJson: r.value_json,
      valueType: r.value_type,
      source: r.source,
      effectiveFrom: r.effective_from,
      effectiveTo: r.effective_to,
      confidenceScore: r.confidence_score,
      notes: r.notes,
      updatedByUserId: r.updated_by_user_id,
      createdAt: r.created_at,
    })),
  });
}
