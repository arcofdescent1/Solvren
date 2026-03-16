import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureApprovalsForRequirements } from "@/services/risk/approvals";
import { auditLog } from "@/lib/audit";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
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

  const orgId = (change as { org_id?: string }).org_id as string;
  const domainKey = (change as { domain?: string }).domain ?? "REVENUE";

  const { data: repRow, error: repErr } = await supabase
    .from("revenue_impact_reports")
    .select("report_json")
    .eq("change_id", changeId)
    .eq("is_current", true)
    .maybeSingle();

  if (repErr) return NextResponse.json({ error: repErr.message }, { status: 500 });
  if (!repRow) return NextResponse.json({ error: "No report to apply" }, { status: 400 });

  const report = ((repRow as { report_json?: unknown }).report_json ?? {}) as Record<string, unknown>;
  const requiredApprovals = (Array.isArray(report.requiredApprovals) ? report.requiredApprovals : [])
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && typeof (x as { role?: unknown }).role === "string") {
        return String((x as { role: string }).role);
      }
      return "";
    })
    .filter(Boolean);

  if (requiredApprovals.length === 0) {
    return NextResponse.json({ ok: true, applied: 0, message: "No requiredApprovals in report" });
  }

  const { data: maps, error: mapErr } = await supabase
    .from("approval_role_map")
    .select("approval_area")
    .eq("domain_key", domainKey)
    .in("role_label", requiredApprovals);

  if (mapErr) return NextResponse.json({ error: mapErr.message }, { status: 500 });

  const approvalAreas = Array.from(
    new Set(
      (maps ?? [])
        .map((m) => String((m as { approval_area?: string }).approval_area ?? ""))
        .filter(Boolean)
    )
  );

  if (approvalAreas.length === 0) {
    return NextResponse.json({ ok: true, applied: 0, message: "No mapped approval areas" });
  }

  const rows = approvalAreas.map((area) => ({
    org_id: orgId,
    change_event_id: changeId,
    approval_area: area,
  }));

  const { error: insErr } = await admin
    .from("change_approval_requirements")
    .upsert(rows, { onConflict: "change_event_id,approval_area" });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const requirementsOverride = approvalAreas.map((role) => ({ role, min: 1 }));
  const { inserted } = await ensureApprovalsForRequirements(admin, {
    orgId,
    changeId,
    domain: domainKey,
    riskBucket: "MEDIUM",
    requirementsOverride,
  });

  await auditLog(supabase, {
    orgId,
    actorId: userRes.user.id,
    action: "AI_APPROVALS_APPLIED",
    entityType: "change_event",
    entityId: changeId,
    metadata: {
      domainKey,
      approvalAreas,
      requiredApprovalsRaw: requiredApprovals,
    },
  });

  return NextResponse.json({ ok: true, applied: rows.length, approvalsInserted: inserted, approvalAreas });
}
