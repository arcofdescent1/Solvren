import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { deriveEvidenceRequirements } from "@/services/evidence";

/**
 * Ensure evidence requirements exist for this change.
 * Derives from change context and upserts change_evidence_items.
 * Safe to call for DRAFT, READY, IN_REVIEW.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: changeId } = await ctx.params;

  const { data: change, error: ceErr } = await scopeActiveChangeEvents(supabase.from("change_events").select(
      "id, org_id, change_type, structured_change_type, domain, systems_involved, backfill_required, rollout_method, customer_impact_expected"
    ))
    .eq("id", changeId)
    .maybeSingle();

  if (ceErr) return NextResponse.json({ error: ceErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reqs = deriveEvidenceRequirements(change as Record<string, unknown>);
  const { data: existing } = await supabase
    .from("change_evidence_items")
    .select("id, kind, status")
    .eq("change_event_id", changeId);

  const byKind = new Map((existing ?? []).map((e) => [String(e.kind), e]));
  let inserted = 0;

  for (const req of reqs) {
    const ex = byKind.get(req.kind);
    if (!ex) {
      const { error: insErr } = await supabase.from("change_evidence_items").insert({
        change_event_id: changeId,
        org_id: change.org_id,
        kind: req.kind,
        label: req.label,
        severity: req.severity,
        status: "MISSING",
      });
      if (!insErr) inserted++;
    } else {
      await supabase
        .from("change_evidence_items")
        .update({ severity: req.severity, label: req.label })
        .eq("id", ex.id);
    }
  }

  if (inserted > 0) {
    await auditLog(supabase, {
      orgId: change.org_id as string,
      actorId: userRes.user.id,
      action: "evidence_requirement_generated",
      entityType: "change",
      entityId: changeId,
      metadata: { count: reqs.length, inserted },
    });
  }

  return NextResponse.json({ ok: true, count: reqs.length, inserted });
}
