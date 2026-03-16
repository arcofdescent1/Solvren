import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: changeId } = await ctx.params;

  const { data: change, error: chErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain")
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

  const domainKey = (change as { domain?: string }).domain ?? "REVENUE";

  const { data: repRow, error: repErr } = await supabase
    .from("revenue_impact_reports")
    .select("report_json, version, created_at")
    .eq("change_id", changeId)
    .eq("is_current", true)
    .maybeSingle();

  if (repErr) return NextResponse.json({ error: repErr.message }, { status: 500 });
  if (!repRow) return NextResponse.json({ ok: true, suggestions: null });

  const report = ((repRow as { report_json?: unknown }).report_json ?? {}) as Record<string, unknown>;
  const requiredApprovalsRaw = Array.isArray(report.requiredApprovals) ? report.requiredApprovals : [];
  const requiredApprovals = requiredApprovalsRaw
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && typeof (x as { role?: unknown }).role === "string") {
        return String((x as { role: string }).role);
      }
      return "";
    })
    .filter(Boolean);

  let approvalAreas: string[] = [];
  if (requiredApprovals.length > 0) {
    const { data: maps, error: mapErr } = await supabase
      .from("approval_role_map")
      .select("role_label, approval_area")
      .eq("domain_key", domainKey)
      .in("role_label", requiredApprovals);

    if (mapErr) return NextResponse.json({ error: mapErr.message }, { status: 500 });
    approvalAreas = uniq(
      (maps ?? []).map((m) => String((m as { approval_area?: string }).approval_area ?? "")).filter(Boolean)
    );
  }

  const failureModes = Array.isArray(report.failureModes) ? report.failureModes : [];
  const requiredSafeguards = Array.isArray(report.requiredSafeguards)
    ? report.requiredSafeguards
    : [];
  const evidenceItems = uniq(
    [
      ...failureModes
        .map((f) => (f && typeof f === "object" ? (f as { title?: unknown }).title : null))
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .map((x) => `Failure mode validation: ${x}`),
      ...requiredSafeguards
        .map((s) => (s && typeof s === "object" ? (s as { title?: unknown }).title : null))
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .map((x) => `Safeguard evidence: ${x}`),
    ].slice(0, 30)
  );

  return NextResponse.json({
    ok: true,
    suggestions: {
      reportVersion: (repRow as { version?: number }).version,
      reportCreatedAt: (repRow as { created_at?: string }).created_at,
      suggestedApprovalAreas: approvalAreas,
      suggestedEvidenceItems: evidenceItems,
      requiredApprovalsRaw: requiredApprovals,
    },
  });
}
