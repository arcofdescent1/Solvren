import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function classifyKind(label: string) {
  if (label.startsWith("Test:")) return "TEST";
  if (label.startsWith("Rollback:")) return "ROLLBACK";
  return "CUSTOM";
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: changeId } = await ctx.params;

  const { data: change, error: chErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id"))
    .eq("id", changeId)
    .maybeSingle();
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = (change as { org_id?: string }).org_id as string;
  const userId = userRes.user.id;

  const { data: repRow, error: repErr } = await supabase
    .from("revenue_impact_reports")
    .select("report_json")
    .eq("change_id", changeId)
    .eq("is_current", true)
    .maybeSingle();

  if (repErr) return NextResponse.json({ error: repErr.message }, { status: 500 });
  if (!repRow) return NextResponse.json({ error: "No report to apply" }, { status: 400 });

  const report = ((repRow as { report_json?: unknown }).report_json ?? {}) as Record<string, unknown>;
  const failureModes = Array.isArray(report.failureModes) ? report.failureModes : [];
  const requiredSafeguards = Array.isArray(report.requiredSafeguards)
    ? report.requiredSafeguards
    : [];
  const labels = uniq(
    [
      ...failureModes
        .map((f) => (f && typeof f === "object" ? (f as { title?: unknown }).title : null))
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .map((t) => `Test: ${t}`),
      ...requiredSafeguards
        .map((s) => (s && typeof s === "object" ? (s as { title?: unknown }).title : null))
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .map((r) => `Rollback: ${r}`),
    ]
      .filter(Boolean)
      .slice(0, 50)
  );

  if (labels.length === 0) return NextResponse.json({ ok: true, applied: 0, message: "No evidence suggestions" });

  const { data: existing } = await supabase
    .from("change_evidence_items")
    .select("kind, label")
    .eq("change_event_id", changeId);

  const existingSet = new Set(
    (existing ?? []).map((e) => `${(e as { kind?: string }).kind}:${(e as { label?: string }).label}`)
  );

  const toInsert = labels.filter((label) => {
    const kind = classifyKind(label);
    return !existingSet.has(`${kind}:${label}`);
  });

  if (toInsert.length === 0) return NextResponse.json({ ok: true, applied: 0, message: "All items already exist" });

  const rows = toInsert.map((label) => ({
    change_event_id: changeId,
    org_id: orgId,
    kind: classifyKind(label),
    label,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("change_evidence_items")
    .insert(rows)
    .select("id, kind, label");

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const insertedRows = (inserted ?? []) as { id: string; kind: string; label: string }[];

  await auditLog(supabase, {
    orgId,
    actorId: userId,
    action: "AI_EVIDENCE_APPLIED",
    entityType: "change_event",
    entityId: changeId,
    metadata: {
      evidenceCount: insertedRows.length,
      sample: insertedRows.slice(0, 10).map((r) => ({ kind: r.kind, label: r.label })),
    },
  });

  return NextResponse.json({ ok: true, applied: insertedRows.length });
}
