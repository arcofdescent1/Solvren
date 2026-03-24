import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Requirement = { role: string; min: number; enabled: boolean };
type Assigned = { role: string; count: number };
type Missing = { role: string; missing: number };

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const changeId = url.searchParams.get("changeId");
  if (!changeId)
    return NextResponse.json({ error: "Missing changeId" }, { status: 400 });

  const { data: change, error: ceErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, sla_status"))
    .eq("id", changeId)
    .single();
  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Not found" },
      { status: 404 }
    );

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: assessment } = await supabase
    .from("impact_assessments")
    .select("risk_bucket, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const domain = (change.domain ?? "REVENUE") as string;
  const bucket = (assessment?.risk_bucket ?? "MEDIUM") as string;
  const orgId = change.org_id as string;

  const { data: reqs, error: reqErr } = await supabase
    .from("approval_requirements")
    .select("required_role, min_count, enabled")
    .eq("org_id", orgId)
    .eq("domain", domain)
    .eq("risk_bucket", bucket)
    .eq("enabled", true);

  if (reqErr)
    return NextResponse.json({ error: reqErr.message }, { status: 500 });

  const baseReqs: Requirement[] = (reqs ?? []).map((r) => ({
    role: String(r.required_role),
    min: Number(r.min_count ?? 1),
    enabled: true,
  }));

  const isEscalated = String(change.sla_status ?? "") === "ESCALATED";
  const hasExec = baseReqs.some((r) => r.role === "EXEC");
  const required: Requirement[] =
    isEscalated && !hasExec
      ? [...baseReqs, { role: "EXEC", min: 1, enabled: true }]
      : baseReqs;

  const { data: approvals, error: apprErr } = await supabase
    .from("approvals")
    .select("approval_area, decision")
    .eq("change_event_id", changeId);

  if (apprErr)
    return NextResponse.json({ error: apprErr.message }, { status: 500 });

  const assignedMap = new Map<string, number>();
  for (const a of approvals ?? []) {
    const role = String(a.approval_area ?? "General");
    assignedMap.set(role, (assignedMap.get(role) ?? 0) + 1);
  }

  const assigned: Assigned[] = required.map((r) => ({
    role: r.role,
    count: assignedMap.get(r.role) ?? 0,
  }));

  const missing: Missing[] = required
    .map((r) => {
      const have = assignedMap.get(r.role) ?? 0;
      return { role: r.role, missing: Math.max(0, r.min - have) };
    })
    .filter((m) => m.missing > 0);

  return NextResponse.json({
    ok: true,
    orgId,
    changeId,
    domain,
    riskBucket: bucket,
    required,
    assigned,
    missing,
  });
}
