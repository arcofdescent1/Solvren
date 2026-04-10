import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRequiredEvidenceAndApprovalAreas } from "@/services/domains/approvalRequirements";
import { filterVisibleChanges } from "@/lib/access/changeAccess";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";

type LegacyView = "my" | "in_review" | "blocked" | "overdue" | "delivery";
type CanonicalView =
  | "all"
  | "needs-review"
  | "needs-details"
  | "overdue"
  | "delivery-health";
type View = LegacyView | CanonicalView;

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

const LEARNED_DELTA_THRESHOLD = 0.1;

export type ReviewRow = {
  changeId: string;
  orgId: string;
  title: string | null;
  status: string | null;
  domain: string | null;
  createdBy: string | null;
  submittedAt: string | null;
  dueAt: string | null;
  slaStatus: string | null;
  riskBucket: string | null;
  riskScore: number | null;
  learnedRiskFlag: boolean;
  topLearnedSignals: Array<{
    signalKey: string;
    incidentRate: number;
    totalChanges: number;
    deltaVsBaseline: number;
    contribution: number;
  }>;
  incidentCount: number;
  myPendingApprovalId: string | null;
  pendingApprovalsCount: number;
  missingEvidenceKinds: string[];
  failedDeliveriesCount: number;
  pendingDeliveriesCount: number;
  isOverdue: boolean;
  isEscalated: boolean;
  failedOutboxIds?: string[];
  pendingOutboxIds?: string[];
  sourceMode?: string | null;
};

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const url = new URL(req.url);
  const learnedRiskFilter = url.searchParams.get("learnedRisk") === "1";
  const hasIncidentsFilter = url.searchParams.get("hasIncidents") === "1";
  const sourceModeFilter = url.searchParams.get("sourceMode");
  const view = (url.searchParams.get("view") ?? "all") as View;
  const validViews: View[] = [
    "my",
    "in_review",
    "blocked",
    "overdue",
    "delivery",
    "all",
    "needs-review",
    "needs-details",
    "delivery-health",
  ];
  const rawView = validViews.includes(view) ? view : "all";
  const viewParam: CanonicalView =
    rawView === "my"
      ? "needs-review"
      : rawView === "in_review"
      ? "all"
      : rawView === "blocked"
      ? "needs-details"
      : rawView === "delivery"
      ? "delivery-health"
      : (rawView as CanonicalView);

  const { data: memberships, error: memErr } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId);

  if (memErr)
    return NextResponse.json({ error: memErr.message }, { status: 500 });

  const orgIds = (memberships ?? []).map((m) => m.org_id);
  if (!orgIds.length)
    return NextResponse.json({
      ok: true,
      rows: [],
      baseline: 0,
      minSamples: 20,
      eligibleSignals: 0,
      lastComputedAt: null,
      counts: { my: 0, in_review: 0, blocked: 0, overdue: 0, delivery: 0 },
    });

  const { data: baselineRow, error: baseErr } = await supabase
    .from("risk_learning_baseline")
    .select("baseline_incident_rate_smoothed, min_samples, last_computed_at")
    .eq("id", 1)
    .maybeSingle();

  if (baseErr)
    return NextResponse.json({ error: baseErr.message }, { status: 500 });

  const baseline = Number(baselineRow?.baseline_incident_rate_smoothed ?? 0);
  const minSamples = Number(baselineRow?.min_samples ?? 20);
  const lastComputedAt = baselineRow?.last_computed_at ?? null;

  const { count: eligibleSignals, error: eligErr } = await supabase
    .from("signal_statistics")
    .select("*", { count: "exact", head: true })
    .gte("total_changes", minSamples);

  if (eligErr)
    return NextResponse.json({ error: eligErr.message }, { status: 500 });

  async function loadLatestAssessments(changeIds: string[]) {
    if (!changeIds.length)
      return new Map<
        string,
        { risk_bucket: string | null; risk_score_raw: number | null }
      >();
    const { data } = await supabase
      .from("impact_assessments")
      .select("change_event_id, risk_bucket, risk_score_raw, created_at")
      .in("change_event_id", changeIds)
      .order("created_at", { ascending: false });
    const map = new Map<
      string,
      { risk_bucket: string | null; risk_score_raw: number | null }
    >();
    for (const row of data ?? []) {
      const cid = row.change_event_id as string;
      if (!map.has(cid))
        map.set(cid, {
          risk_bucket: row.risk_bucket ?? null,
          risk_score_raw: row.risk_score_raw ?? null,
        });
    }
    return map;
  }

  const nowIso = new Date().toISOString();
  let changeRows: Array<{
    id: string;
    org_id: string;
    title: string | null;
    status: string | null;
    domain: string | null;
    created_by: string | null;
    is_restricted?: boolean | null;
    submitted_at: string | null;
    due_at: string | null;
    sla_status: string | null;
    source_mode?: string | null;
  }> = [];

  if (viewParam === "needs-review") {
    const { data: appr, error } = await supabase
      .from("approvals")
      .select("id, change_event_id, decision, org_id")
      .in("org_id", orgIds)
      .eq("approver_user_id", userId)
      .eq("decision", "PENDING");
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    const ids = uniq((appr ?? []).map((a) => a.change_event_id).filter(Boolean));
    if (!ids.length)
      return NextResponse.json({
        ok: true,
        rows: [],
        baseline,
        minSamples,
        eligibleSignals: eligibleSignals ?? 0,
        lastComputedAt,
        counts: { my: 0, in_review: 0, blocked: 0, overdue: 0, delivery: 0 },
      });
    const { data: changes, error: ceErr } = await scopeActiveChangeEvents(
      supabase
        .from("change_events")
        .select(
          "id, org_id, title, status, domain, created_by, submitted_at, due_at, sla_status, source_mode"
        )
    ).in("id", ids);
    if (ceErr)
      return NextResponse.json({ error: ceErr.message }, { status: 500 });
    changeRows = changes ?? [];
  } else if (viewParam === "overdue") {
    const { data: overdueDue } = await scopeActiveChangeEvents(
      supabase
        .from("change_events")
        .select(
          "id, org_id, title, status, domain, created_by, submitted_at, due_at, sla_status, source_mode"
        )
        .in("org_id", orgIds)
        .eq("status", "IN_REVIEW")
    ).lt("due_at", nowIso);
    const { data: overdueEsc } = await scopeActiveChangeEvents(
      supabase
        .from("change_events")
        .select(
          "id, org_id, title, status, domain, created_by, submitted_at, due_at, sla_status, source_mode"
        )
        .in("org_id", orgIds)
        .eq("status", "IN_REVIEW")
    ).eq("sla_status", "ESCALATED");
    const overdueById = new Map(
      [...(overdueDue ?? []), ...(overdueEsc ?? [])].map((c) => [c.id, c])
    );
    changeRows = Array.from(overdueById.values());
  } else if (viewParam === "delivery-health") {
    const { data: outbox, error: obErr } = await supabase
      .from("notification_outbox")
      .select("id, change_event_id, status, created_at")
      .in("org_id", orgIds)
      .in("status", ["FAILED", "PENDING", "PROCESSING"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (obErr)
      return NextResponse.json({ error: obErr.message }, { status: 500 });
    const ids = uniq(
      (outbox ?? []).map((o) => o.change_event_id).filter(Boolean)
    );
    if (!ids.length)
      return NextResponse.json({
        ok: true,
        rows: [],
        baseline,
        minSamples,
        eligibleSignals: eligibleSignals ?? 0,
        lastComputedAt,
        counts: { my: 0, in_review: 0, blocked: 0, overdue: 0, delivery: 0 },
      });
    const { data: changes, error: ceErr } = await scopeActiveChangeEvents(
      supabase
        .from("change_events")
        .select(
          "id, org_id, title, status, domain, created_by, submitted_at, due_at, sla_status, source_mode"
        )
    ).in("id", ids);
    if (ceErr)
      return NextResponse.json({ error: ceErr.message }, { status: 500 });
    changeRows = changes ?? [];
  } else {
    const q = scopeActiveChangeEvents(
      supabase
        .from("change_events")
        .select(
          "id, org_id, title, status, domain, created_by, submitted_at, due_at, sla_status, source_mode"
        )
        .in("org_id", orgIds)
        .in("status", ["DRAFT", "READY", "IN_REVIEW", "SUBMITTED"])
    );
    const { data: changes, error: ceErr } = await q
      .order("due_at", { ascending: true })
      .limit(viewParam === "needs-details" ? 500 : 200);
    if (ceErr)
      return NextResponse.json({ error: ceErr.message }, { status: 500 });
    changeRows = changes ?? [];
  }

  changeRows = await filterVisibleChanges(supabase, userId, changeRows);

  if (sourceModeFilter && sourceModeFilter !== "all") {
    if (sourceModeFilter === "OTHER_LEGACY") {
      changeRows = changeRows.filter((c) => !c.source_mode || c.source_mode === "UNKNOWN");
    } else {
      changeRows = changeRows.filter((c) => c.source_mode === sourceModeFilter);
    }
  }

  const changeIds = changeRows.map((c) => c.id);
  if (!changeIds.length)
    return NextResponse.json({
      ok: true,
      rows: [],
      baseline,
      minSamples,
      eligibleSignals: eligibleSignals ?? 0,
      lastComputedAt,
      counts: { my: 0, in_review: 0, blocked: 0, overdue: 0, delivery: 0 },
    });

  const assessmentMap = await loadLatestAssessments(changeIds);

  const { data: inc } = await supabase
    .from("incidents")
    .select("change_event_id")
    .in("change_event_id", changeIds);
  const incidentCountMap = new Map<string, number>();
  for (const row of inc ?? []) {
    const cid = row.change_event_id as string;
    incidentCountMap.set(cid, (incidentCountMap.get(cid) ?? 0) + 1);
  }

  const { data: apprAll } = await supabase
    .from("approvals")
    .select("id, change_event_id, decision, approver_user_id")
    .in("change_event_id", changeIds);
  const pendingApprovalsCountMap = new Map<string, number>();
  const myPendingApprovalIdMap = new Map<string, string>();
  for (const a of apprAll ?? []) {
    const cid = a.change_event_id as string;
    if (a.decision === "PENDING") {
      pendingApprovalsCountMap.set(
        cid,
        (pendingApprovalsCountMap.get(cid) ?? 0) + 1
      );
      if (a.approver_user_id === userId)
        myPendingApprovalIdMap.set(cid, a.id);
    }
  }

  const { data: evidence } = await supabase
    .from("change_evidence")
    .select("change_event_id, kind")
    .in("change_event_id", changeIds);
  const evidenceMap = new Map<string, Set<string>>();
  for (const ev of evidence ?? []) {
    const cid = ev.change_event_id as string;
    const set = evidenceMap.get(cid) ?? new Set<string>();
    set.add(ev.kind);
    evidenceMap.set(cid, set);
  }

  const domains = uniq(
    changeRows.map((c) => c.domain ?? "REVENUE")
  ) as string[];
  const orgId = orgIds[0] as string;

  const domainApprovalEvidenceMap = new Map<string, string[]>();
  for (const d of domains) {
    try {
      const { requiredEvidenceKinds } = await getRequiredEvidenceAndApprovalAreas(
        supabase,
        { orgId, domainKey: d }
      );
      if (requiredEvidenceKinds.length > 0) {
        domainApprovalEvidenceMap.set(d, requiredEvidenceKinds);
      }
    } catch {
      // Ignore, fall back to templateMap
    }
  }

  const { data: templates } = await supabase
    .from("domain_governance_templates")
    .select("domain, risk_bucket, required_evidence_kinds, required_approval_areas, checklist_sections, enabled")
    .in("domain", domains)
    .eq("enabled", true);
  const templateMap = new Map<
    string,
    { required_evidence_kinds?: string[] }
  >();
  for (const t of templates ?? [])
    templateMap.set(`${t.domain}:${t.risk_bucket}`, {
      required_evidence_kinds: (t.required_evidence_kinds ?? []) as string[],
    });

  // Only fetch outbox rows we need: FAILED/PENDING for badge; add PROCESSING in delivery view for diagnostics
  const outboxStatuses =
    viewParam === "delivery-health"
      ? ["FAILED", "PENDING", "PROCESSING"]
      : ["FAILED", "PENDING"];
  const { data: outboxRows } = await supabase
    .from("notification_outbox")
    .select("id, change_event_id, status")
    .in("change_event_id", changeIds)
    .in("status", outboxStatuses);
  const failedDeliveryMap = new Map<string, number>();
  const pendingDeliveryMap = new Map<string, number>();
  const failedOutboxIdsMap = new Map<string, string[]>();
  const pendingOutboxIdsMap = new Map<string, string[]>();
  for (const o of outboxRows ?? []) {
    const cid = o.change_event_id as string;
    const id = o.id as string;
    if (o.status === "FAILED") {
      failedDeliveryMap.set(cid, (failedDeliveryMap.get(cid) ?? 0) + 1);
      const arr = failedOutboxIdsMap.get(cid) ?? [];
      arr.push(id);
      failedOutboxIdsMap.set(cid, arr);
    }
    if (o.status === "PENDING" || o.status === "PROCESSING") {
      pendingDeliveryMap.set(cid, (pendingDeliveryMap.get(cid) ?? 0) + 1);
      const arr = pendingOutboxIdsMap.get(cid) ?? [];
      arr.push(id);
      pendingOutboxIdsMap.set(cid, arr);
    }
  }

  function requiredEvidenceFor(domain: string, bucket: string | null): string[] {
    const fromDomainApproval = domainApprovalEvidenceMap.get(domain);
    if (fromDomainApproval && fromDomainApproval.length > 0) {
      return fromDomainApproval;
    }
    const key = `${domain}:${bucket ?? "MEDIUM"}`;
    const tpl = templateMap.get(key);
    const arr = tpl?.required_evidence_kinds ?? [];
    return Array.isArray(arr) ? arr : [];
  }

  // Learning: signal snapshots + stats
  const { data: snaps } = await supabase
    .from("change_signal_snapshot")
    .select("change_event_id, signal_key, contribution")
    .in("change_event_id", changeIds);
  const snapsByChange = new Map<string, Array<{ key: string; contribution: number }>>();
  const allKeys = new Set<string>();
  for (const s of snaps ?? []) {
    const cid = s.change_event_id as string;
    const key = String(s.signal_key);
    const contrib = Number(s.contribution ?? 0);
    allKeys.add(key);
    const arr = snapsByChange.get(cid) ?? [];
    arr.push({ key, contribution: contrib });
    snapsByChange.set(cid, arr);
  }

  const keys = Array.from(allKeys);
  const { data: stats } = await supabase
    .from("signal_statistics")
    .select("signal_key, total_changes, incident_rate_smoothed")
    .in("signal_key", keys);
  const statsMap = new Map<string, { rate: number; total: number }>();
  for (const r of stats ?? []) {
    const row = r as {
      signal_key: string;
      total_changes: number;
      incident_rate_smoothed?: number;
    };
    statsMap.set(String(row.signal_key), {
      rate: Number(row.incident_rate_smoothed ?? 0),
      total: Number(row.total_changes ?? 0),
    });
  }

  let rows: ReviewRow[] = changeRows.map((c) => {
    const a = assessmentMap.get(c.id);
    const required = requiredEvidenceFor(c.domain ?? "REVENUE", a?.risk_bucket ?? null);
    const present = evidenceMap.get(c.id) ?? new Set<string>();
    const missing = required.filter((k) => !present.has(k));

    const signals = snapsByChange.get(c.id) ?? [];
    const learnedSignals = signals
      .map((s) => {
        const st = statsMap.get(s.key);
        const total = st?.total ?? 0;
        if (total < minSamples) return null;
        const rate = st?.rate ?? 0;
        const delta = rate - baseline;
        return {
          signalKey: s.key,
          incidentRate: rate,
          totalChanges: total,
          deltaVsBaseline: delta,
          contribution: s.contribution,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    learnedSignals.sort((x, y) => (y.deltaVsBaseline ?? 0) - (x.deltaVsBaseline ?? 0));
    const learnedRiskFlag = learnedSignals.some(
      (ls) => (ls.deltaVsBaseline ?? 0) >= LEARNED_DELTA_THRESHOLD
    );
    const topLearnedSignals = learnedSignals.slice(0, 2).map((ls) => ({
      signalKey: ls.signalKey,
      incidentRate: ls.incidentRate,
      totalChanges: ls.totalChanges,
      deltaVsBaseline: ls.deltaVsBaseline,
      contribution: ls.contribution,
    }));

    const dueAtIso = c.due_at ?? null;
    const isOverdue = !!(
      dueAtIso &&
      dueAtIso < nowIso &&
      (c.status ?? "") === "IN_REVIEW"
    );
    const isEscalated = (c.sla_status ?? null) === "ESCALATED";

    return {
      changeId: c.id,
      orgId: c.org_id,
      title: c.title ?? null,
      status: c.status ?? null,
      domain: c.domain ?? null,
      createdBy: c.created_by ?? null,
      submittedAt: c.submitted_at ?? null,
      dueAt: c.due_at ?? null,
      slaStatus: c.sla_status ?? null,
      riskBucket: a?.risk_bucket ?? null,
      riskScore: a?.risk_score_raw != null ? Number(a.risk_score_raw) : null,
      learnedRiskFlag,
      topLearnedSignals,
      incidentCount: incidentCountMap.get(c.id) ?? 0,
      myPendingApprovalId: myPendingApprovalIdMap.get(c.id) ?? null,
      pendingApprovalsCount: pendingApprovalsCountMap.get(c.id) ?? 0,
      missingEvidenceKinds: missing,
      failedDeliveriesCount: failedDeliveryMap.get(c.id) ?? 0,
      pendingDeliveriesCount: pendingDeliveryMap.get(c.id) ?? 0,
      isOverdue,
      isEscalated,
      failedOutboxIds:
        viewParam === "delivery-health"
          ? (failedOutboxIdsMap.get(c.id) ?? [])
          : undefined,
      pendingOutboxIds:
        viewParam === "delivery-health"
          ? (pendingOutboxIdsMap.get(c.id) ?? [])
          : undefined,
      sourceMode: c.source_mode ?? null,
    };
  });

  rows = rows.filter((r) => (hasIncidentsFilter ? r.incidentCount > 0 : true));
  rows = rows.filter((r) =>
    learnedRiskFilter ? r.learnedRiskFlag === true : true
  );
  if (viewParam === "needs-details")
    rows = rows.filter(
      (r) =>
        r.missingEvidenceKinds.length > 0 ||
        (r.status ?? "") === "DRAFT" ||
        ((r.status ?? "") === "IN_REVIEW" && r.pendingApprovalsCount === 0)
    );

  // Counts for tabs (my = distinct changes with my PENDING approval)
  const [
    { data: myApprovalsData },
    { data: inReviewData },
    { data: overdueDueData },
    { data: overdueEscData },
    { data: deliveryOutbox },
  ] = await Promise.all([
    supabase
      .from("approvals")
      .select("change_event_id")
      .in("org_id", orgIds)
      .eq("approver_user_id", userId)
      .eq("decision", "PENDING"),
    scopeActiveChangeEvents(supabase.from("change_events").select("id").in("org_id", orgIds).eq("status", "IN_REVIEW")),
      scopeActiveChangeEvents(
        supabase.from("change_events").select("id").in("org_id", orgIds).eq("status", "IN_REVIEW")
      ).lt("due_at", nowIso),
      scopeActiveChangeEvents(
        supabase.from("change_events").select("id").in("org_id", orgIds).eq("status", "IN_REVIEW")
      ).eq("sla_status", "ESCALATED"),
      supabase
        .from("notification_outbox")
        .select("change_event_id")
        .in("org_id", orgIds)
      .in("status", ["FAILED", "PENDING", "PROCESSING"]),
    ]);

  const inReviewIds = ((inReviewData ?? []) as { id: string }[]).map((c) => c.id);
  const rawOverdueIds = [
    ...((overdueDueData ?? []) as { id: string }[]).map((c) => c.id),
    ...((overdueEscData ?? []) as { id: string }[]).map((c) => c.id),
  ];
  const rawDeliveryChangeIds = uniq(
    ((deliveryOutbox ?? []) as { change_event_id?: string | null }[])
      .map((o) => o.change_event_id)
      .filter((x): x is string => Boolean(x))
  );

  async function toVisibleIds(ids: string[]) {
    const uniqIds = uniq(ids);
    if (uniqIds.length === 0) return [] as string[];
    const { data: rowsForVisibility } = await scopeActiveChangeEvents(
      supabase.from("change_events").select("id, org_id, domain, status, created_by")
    ).in("id", uniqIds);
    const visibleRows = await filterVisibleChanges(supabase, userId, rowsForVisibility ?? []);
    return visibleRows.map((r) => r.id);
  }

  const myChangeIds = await toVisibleIds(
    ((myApprovalsData ?? []) as { change_event_id?: string | null }[])
      .map((a) => a.change_event_id)
      .filter((x): x is string => Boolean(x))
  );
  const visibleInReviewIds = await toVisibleIds(inReviewIds);
  const overdueIds = new Set(await toVisibleIds(rawOverdueIds));
  const deliveryChangeIds = await toVisibleIds(rawDeliveryChangeIds);

  let blockedCount = 0;
  if (visibleInReviewIds.length > 0) {
    const assessForBlocked = await loadLatestAssessments(visibleInReviewIds);
    const { data: inReviewWithDomain } = await scopeActiveChangeEvents(
      supabase.from("change_events").select("id, domain")
    ).in("id", visibleInReviewIds);
    const domainByChange = new Map<string, string>(
      ((inReviewWithDomain ?? []) as { id: string; domain?: string | null }[]).map((c) => [
        c.id,
        c.domain ?? "REVENUE",
      ])
    );
    const { data: evBlocked } = await supabase
      .from("change_evidence")
      .select("change_event_id, kind")
      .in("change_event_id", visibleInReviewIds);
    const evByChange = new Map<string, Set<string>>();
    for (const e of evBlocked ?? []) {
      const cid = e.change_event_id as string;
      const set = evByChange.get(cid) ?? new Set<string>();
      set.add(e.kind);
      evByChange.set(cid, set);
    }
    for (const id of visibleInReviewIds) {
      const domain = domainByChange.get(id) ?? "REVENUE";
      const a = assessForBlocked.get(id);
      const required = requiredEvidenceFor(domain, a?.risk_bucket ?? null);
      const present = evByChange.get(id) ?? new Set<string>();
      const missing = required.filter((k) => !present.has(k));
      if (missing.length > 0) blockedCount++;
    }
  }

  const counts = {
    my: myChangeIds.length,
    in_review: visibleInReviewIds.length,
    blocked: blockedCount,
    overdue: overdueIds.size,
    delivery: deliveryChangeIds.length,
  };

  return NextResponse.json({
    ok: true,
    baseline,
    minSamples,
    eligibleSignals: eligibleSignals ?? 0,
    lastComputedAt,
    rows,
    counts,
  });
}
