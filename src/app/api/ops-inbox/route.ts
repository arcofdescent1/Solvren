import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MyQueueItem = {
  approvalId: string;
  changeEventId: string;
  title: string | null;
  domain: string | null;
  dueAt: string | null;
  riskBucket: string | null;
  approvalArea: string;
};

export type InReviewItem = {
  changeEventId: string;
  title: string | null;
  domain: string | null;
  status: string | null;
  dueAt: string | null;
  riskBucket: string | null;
  riskScore: number | null;
};

export type BlockedItem = {
  changeEventId: string;
  title: string | null;
  domain: string | null;
  reason: "missing_evidence" | "approvals_stalled";
  missingEvidenceKinds?: string[];
};

export type OverdueItem = {
  changeEventId: string;
  title: string | null;
  domain: string | null;
  dueAt: string | null;
  slaStatus: string | null;
};

export type DeliveryIssueItem = {
  outboxId: string;
  changeEventId: string | null;
  channel: string | null;
  templateKey: string | null;
  lastError: string | null;
};

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id);

  const orgIds = (memberships ?? []).map((m) => m.org_id);
  if (!orgIds.length)
    return NextResponse.json({
      ok: true,
      myQueue: [],
      inReview: [],
      blocked: [],
      overdue: [],
      deliveryIssues: [],
    });

  const userId = userRes.user.id;
  const nowIso = new Date().toISOString();

  // My queue: approvals assigned to me, PENDING, with change info
  const { data: myApprovals } = await supabase
    .from("approvals")
    .select("id, change_event_id, approval_area, org_id, domain")
    .in("org_id", orgIds)
    .eq("approver_user_id", userId)
    .eq("decision", "PENDING");

  const myChangeIds = Array.from(
    new Set((myApprovals ?? []).map((a) => a.change_event_id))
  );

  let myQueue: MyQueueItem[] = [];
  if (myChangeIds.length > 0) {
    const { data: myChanges } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, title, domain, due_at"))
      .in("id", myChangeIds);
    const { data: myAssessments } = await supabase
      .from("impact_assessments")
      .select("change_event_id, risk_bucket")
      .in("change_event_id", myChangeIds)
      .order("created_at", { ascending: false });

    const changeMap = new Map(
      (myChanges ?? []).map((c) => [c.id, c])
    );
    const bucketByChange = new Map<string, string | null>();
    for (const a of myAssessments ?? []) {
      const cid = a.change_event_id as string;
      if (!bucketByChange.has(cid))
        bucketByChange.set(cid, a.risk_bucket ?? null);
    }

    myQueue = (myApprovals ?? []).map((a) => {
      const c = changeMap.get(a.change_event_id as string);
      return {
        approvalId: a.id,
        changeEventId: a.change_event_id as string,
        title: c?.title ?? null,
        domain: (c?.domain ?? a.domain) as string | null,
        dueAt: c?.due_at ?? null,
        riskBucket: bucketByChange.get(a.change_event_id as string) ?? null,
        approvalArea: a.approval_area ?? "",
      };
    });
    myQueue.sort(
      (a, b) =>
        new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()
    );
  }

  // In review: all IN_REVIEW changes with latest assessment
  const { data: inReviewChanges } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, title, domain, status, due_at"))
    .in("org_id", orgIds)
    .eq("status", "IN_REVIEW")
    .order("due_at", { ascending: true });

  const inReviewIds = (inReviewChanges ?? []).map((c) => c.id);
  const assessByChange = new Map<
    string,
    { riskBucket: string | null; riskScore: number | null }
  >();
  if (inReviewIds.length > 0) {
    const { data: inReviewAssessments } = await supabase
      .from("impact_assessments")
      .select("change_event_id, risk_bucket, risk_score_raw")
      .in("change_event_id", inReviewIds)
      .order("created_at", { ascending: false });

    for (const a of inReviewAssessments ?? []) {
      const cid = a.change_event_id as string;
      if (!assessByChange.has(cid))
        assessByChange.set(cid, {
          riskBucket: a.risk_bucket ?? null,
          riskScore:
            a.risk_score_raw != null ? Number(a.risk_score_raw) : null,
        });
    }
  }

  const inReview: InReviewItem[] = (inReviewChanges ?? []).map((c) => {
    const a = assessByChange.get(c.id);
    return {
      changeEventId: c.id,
      title: c.title ?? null,
      domain: c.domain ?? null,
      status: c.status ?? null,
      dueAt: c.due_at ?? null,
      riskBucket: a?.riskBucket ?? null,
      riskScore: a?.riskScore ?? null,
    };
  });

  // Overdue: IN_REVIEW and (due_at < now or sla_status OVERDUE/ESCALATED)
  const { data: overdueChanges } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, title, domain, due_at, sla_status"))
    .in("org_id", orgIds)
    .eq("status", "IN_REVIEW")
    .or("due_at.lt." + nowIso + ",sla_status.eq.OVERDUE,sla_status.eq.ESCALATED");

  const overdue: OverdueItem[] = (overdueChanges ?? []).map((c) => ({
    changeEventId: c.id,
    title: c.title ?? null,
    domain: c.domain ?? null,
    dueAt: c.due_at ?? null,
    slaStatus: c.sla_status ?? null,
  }));

  // Blocked: IN_REVIEW changes missing required evidence (simplified: we'd need template + evidence per change; return changes that have at least one PENDING approval and/or we can compute missing evidence server-side)
  const blocked: BlockedItem[] = [];
  if (inReviewIds.length > 0) {
    const { data: govTemplates } = await supabase
      .from("domain_governance_templates")
      .select("domain, risk_bucket, required_evidence_kinds")
      .in("domain", ["REVENUE", "DATA", "WORKFLOW", "SECURITY"])
      .eq("enabled", true);
    const { data: evidenceRows } = await supabase
      .from("change_evidence")
      .select("change_event_id, kind")
      .in("change_event_id", inReviewIds);
    const { data: allApprovals } = await supabase
      .from("approvals")
      .select("change_event_id, decision")
      .in("change_event_id", inReviewIds);

    const evidenceByChange = new Map<string, Set<string>>();
    for (const e of evidenceRows ?? []) {
      const cid = e.change_event_id as string;
      const set = evidenceByChange.get(cid) ?? new Set();
      set.add(e.kind as string);
      evidenceByChange.set(cid, set);
    }
    const pendingCountByChange = new Map<string, number>();
    for (const a of allApprovals ?? []) {
      const cid = a.change_event_id as string;
      if (a.decision === "PENDING")
        pendingCountByChange.set(
          cid,
          (pendingCountByChange.get(cid) ?? 0) + 1
        );
    }

    const templateByKey = new Map<
      string,
      { required_evidence_kinds: string[] }
    >();
    for (const t of govTemplates ?? []) {
      const key = `${t.domain}:${t.risk_bucket}`;
      templateByKey.set(key, {
        required_evidence_kinds: (t.required_evidence_kinds ?? []) as string[],
      });
    }

    for (const c of inReviewChanges ?? []) {
      const a = assessByChange.get(c.id);
      const bucket = a?.riskBucket ?? "MEDIUM";
      const domain = (c.domain ?? "REVENUE") as string;
      const tpl = templateByKey.get(`${domain}:${bucket}`);
      const required = tpl?.required_evidence_kinds ?? [];
      const present = evidenceByChange.get(c.id) ?? new Set();
      const missing = required.filter((k) => !present.has(k));
      const pendingApprovals = pendingCountByChange.get(c.id) ?? 0;

      if (missing.length > 0) {
        blocked.push({
          changeEventId: c.id,
          title: c.title ?? null,
          domain: c.domain ?? null,
          reason: "missing_evidence",
          missingEvidenceKinds: missing,
        });
      } else if (pendingApprovals > 0 && required.length > 0) {
        blocked.push({
          changeEventId: c.id,
          title: c.title ?? null,
          domain: c.domain ?? null,
          reason: "approvals_stalled",
        });
      }
    }
  }

  // Delivery issues: outbox FAILED
  const { data: failedOutbox } = await supabase
    .from("notification_outbox")
    .select("id, change_event_id, channel, template_key, last_error")
    .in("org_id", orgIds)
    .eq("status", "FAILED");

  const deliveryIssues: DeliveryIssueItem[] = (failedOutbox ?? []).map((r) => ({
    outboxId: r.id,
    changeEventId: r.change_event_id ?? null,
    channel: r.channel ?? null,
    templateKey: r.template_key ?? null,
    lastError: r.last_error ?? null,
  }));

  return NextResponse.json({
    ok: true,
    myQueue,
    inReview,
    blocked,
    overdue,
    deliveryIssues,
  });
}
