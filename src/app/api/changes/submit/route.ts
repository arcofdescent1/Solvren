import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { auditLog } from "@/lib/audit";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { enqueueNotificationEvents } from "@/services/notifications/createNotifications";
import { enqueueExecutiveDmNotifications } from "@/services/notifications/enqueueExecutiveDmNotifications";
import { enqueueJiraIssuePropertySync, enqueueJiraCommentSync } from "@/services/jira/jiraSyncService";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { assertDomainEnabled } from "@/services/domains/validateDomainEnabled";
import { validateChange } from "@/services/changeValidation";
import { computeDueAt } from "@/services/risk/sla";
import { recomputeAndPersistRevenueFields } from "@/services/risk/revenuePersist";
import { getReadyStatus } from "@/services/risk/readyStatus";
import { canRole } from "@/lib/rbac/permissions";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { runRevenueImpactGeneration } from "@/services/revenueImpact/runRevenueImpactGeneration";
import { runCoordinationPlanGeneration } from "@/services/coordination/runCoordinationPlanGeneration";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import {
  evaluateGovernance,
  bindGovernanceApprovalRequest,
  deploymentGovernanceEnvironment,
} from "@/modules/governance";

type Body = { changeEventId: string; createdByUserId?: string };

async function internalFetch(
  baseUrl: string,
  path: string,
  cookie: string,
  body: unknown
) {
  const resp = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
  return resp;
}

async function internalFetchWithSecret(
  baseUrl: string,
  path: string,
  secret: string,
  body: unknown
) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    },
    body: JSON.stringify(body),
  });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternal =
    !!env.cronSecret &&
    internalSecret === env.cronSecret;

  if (!isInternal) {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
    if (forbidden) return forbidden;
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.changeEventId)
    return NextResponse.json(
      { error: "Missing changeEventId" },
      { status: 400 }
    );

  if (isInternal && !body.createdByUserId)
    return NextResponse.json(
      { error: "createdByUserId required for internal submit" },
      { status: 400 }
    );

  const baseUrl = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";
  const actorId = isInternal
    ? (body.createdByUserId ?? "")
    : (await supabase.auth.getUser()).data.user?.id ?? "";

  const db = isInternal ? admin : supabase;

  const changeRowQuery = isInternal
    ? admin.from("change_events").select("*").eq("id", body.changeEventId)
    : scopeActiveChangeEvents(supabase.from("change_events").select("*")).eq("id", body.changeEventId);

  const { data: change, error: ceErr } = await changeRowQuery.single();

  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Change not found" },
      { status: 404 }
    );

  if (!isInternal) {
    const status = (change.status ?? "DRAFT") as string;
    if (status !== "DRAFT" && status !== "READY") {
      return NextResponse.json(
        { error: "Only draft or ready changes can be submitted", details: [] },
        { status: 400 }
      );
    }
    const validation = await validateChange({
      changeId: body.changeEventId,
      supabase: db,
      requireAssessment: true,
    });
    if (!validation.ready) {
      await auditLog(db, {
        orgId: change.org_id,
        actorId,
        action: "change_submission_blocked",
        entityType: "change",
        entityId: body.changeEventId,
        metadata: { issue_codes: validation.errors.map((i) => i.code) },
      });
      return NextResponse.json(
        {
          error: "Change not ready for submission",
          details: validation.issues.map((i) => i.message),
          validation: {
            ready: validation.ready,
            issues: validation.issues,
          },
        },
        { status: 400 }
      );
    }
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", change.org_id)
      .eq("user_id", actorId)
      .maybeSingle();

    if (!member)
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
    const actorRole = parseOrgRole((member as { role?: string | null }).role ?? null);
    if (!canRole(actorRole, "change.submit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const isOwnerOfChange = change.created_by === actorId;
    if (!isOwnerOfChange && !isAdminLikeRole(actorRole)) {
      return NextResponse.json(
        { error: "Only the change owner (or owner/admin) can submit this change." },
        { status: 403 }
      );
    }
  }

  // Idempotency: if already in review & has submitted_at, don't re-start SLA / re-notify
  // (Internal/cron may call with IN_REVIEW; user flow rejects non-DRAFT/READY above)
  if ((change.status ?? "") === "IN_REVIEW" && change.submitted_at) {
    return NextResponse.json({
      ok: true,
      alreadySubmitted: true,
      message: "Change is already in review.",
    });
  }

  const domainKey = (change.domain ?? "REVENUE") as string;
  try {
    await assertDomainEnabled(db, { orgId: change.org_id as string, domainKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Domain not enabled";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 1) Ensure assessment exists (compute if missing; skip when internal - already computed)
  const { data: existingAssessment } = await db
    .from("impact_assessments")
    .select("id")
    .eq("change_event_id", body.changeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingAssessment?.id) {
    const computeResp = isInternal
      ? await internalFetchWithSecret(
          baseUrl,
          "/api/assessments/compute",
          env.cronSecret ?? "",
          { changeEventId: body.changeEventId }
        )
      : await internalFetch(
          baseUrl,
          "/api/assessments/compute",
          cookie,
          { changeEventId: body.changeEventId }
        );
    if (!computeResp.ok) {
      const j = await computeResp.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            (j as { error?: string })?.error ??
            "No assessment; compute failed",
        },
        { status: 500 }
      );
    }
  }

  // 2) Run Pass A (best-effort; skip when internal)
  let passAOk = false;
  if (!isInternal) {
    try {
      const passAResp = await internalFetch(baseUrl, "/api/ai/pass-a", cookie, {
        changeEventId: body.changeEventId,
      });
      passAOk = passAResp.ok;
    } catch {
      passAOk = false;
    }
  }

  // 3) Recompute score (skip when internal - already done)
  const recomputeResp = isInternal
    ? ({ ok: true } as Response)
    : await internalFetch(
        baseUrl,
        "/api/assessments/compute",
        cookie,
        { changeEventId: body.changeEventId }
      );
  if (!recomputeResp.ok) {
    const j = await recomputeResp.json().catch(() => ({}));
    return NextResponse.json(
      {
        error:
          (j as { error?: string })?.error ??
          "Failed to recompute after Pass A",
      },
      { status: 500 }
    );
  }

  // 3.5) Snapshot signals at time of submission (Phase 2 memory layer)
  const { data: signalsForSnapshot, error: snapSigErr } = await db
    .from("risk_signals")
    .select("signal_key, value_type, value_bool, value_num, weight_at_time, contribution")
    .eq("change_event_id", body.changeEventId);

  if (snapSigErr) {
    return NextResponse.json({ error: snapSigErr.message }, { status: 500 });
  }

  const { error: delSnapErr } = await db
    .from("change_signal_snapshot")
    .delete()
    .eq("change_event_id", body.changeEventId);

  if (delSnapErr) {
    return NextResponse.json({ error: delSnapErr.message }, { status: 500 });
  }

  const changeDomain = (change.domain ?? "REVENUE") as string;
  const snapshotRows = (signalsForSnapshot ?? []).map((s) => {
    const signalValue =
      s.value_type === "BOOLEAN"
        ? String(Boolean(s.value_bool))
        : String(s.value_num ?? "");

    return {
      org_id: change.org_id,
      change_event_id: body.changeEventId,
      domain: changeDomain,
      signal_key: s.signal_key,
      signal_value: signalValue.length ? signalValue : null,
      weight_at_time: Number(s.weight_at_time ?? 0),
      contribution: Number(s.contribution ?? 0),
    };
  });

  if (snapshotRows.length > 0) {
    const { error: insSnapErr } = await db
      .from("change_signal_snapshot")
      .insert(snapshotRows);

    if (insSnapErr) {
      return NextResponse.json({ error: insSnapErr.message }, { status: 500 });
    }

    await auditLog(db, {
      orgId: change.org_id,
      actorId,
      action: "signal_snapshot_created",
      entityType: "change",
      entityId: body.changeEventId,
      metadata: { signals_snapshotted: snapshotRows.length },
    });
  }

  // 4) Get latest assessment for risk_bucket, compute due_at
  const { data: latestAssessment, error: laErr } = await db
    .from("impact_assessments")
    .select("id, risk_bucket")
    .eq("change_event_id", body.changeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (laErr || !latestAssessment?.id) {
    return NextResponse.json(
      { error: laErr?.message ?? "No latest assessment found" },
      { status: 500 }
    );
  }

  const submittedAt = new Date();
  const dueAt = await computeDueAt(
    db,
    change.domain ?? "REVENUE",
    latestAssessment.risk_bucket ?? null,
    submittedAt
  );

  // 5) Regenerate checklist (creates approvals via ensureApprovalsForRequirements)
  const checklistResp = isInternal
    ? await internalFetchWithSecret(
        baseUrl,
        "/api/assessments/generate-checklist",
        env.cronSecret ?? "",
        { changeEventId: body.changeEventId }
      )
    : await internalFetch(
        baseUrl,
        "/api/assessments/generate-checklist",
        cookie,
        { changeEventId: body.changeEventId }
      );
  if (!checklistResp.ok) {
    const j = await checklistResp.json().catch(() => ({}));
    return NextResponse.json(
      {
        error:
          (j as { error?: string })?.error ?? "Failed to generate checklist",
      },
      { status: 500 }
    );
  }

  const checklistJson = (await checklistResp.json().catch(() => ({}))) as {
    approvals_inserted?: number;
  };
  const approvalsInserted = Number(checklistJson?.approvals_inserted ?? 0);

  await auditLog(db, {
    orgId: change.org_id,
    actorId,
    action: "checklist_generated",
    entityType: "change",
    entityId: body.changeEventId,
    metadata: { domain: change.domain ?? "REVENUE" },
  });

  const { data: approvalAreas } = await db
    .from("approvals")
    .select("approval_area")
    .eq("change_event_id", body.changeEventId);
  const areas = [...new Set((approvalAreas ?? []).map((a) => a.approval_area).filter(Boolean))];

  await addTimelineEvent({
    supabase: db,
    orgId: change.org_id,
    changeEventId: body.changeEventId,
    actorUserId: actorId || undefined,
    eventType: "APPROVERS_ASSIGNED",
    title: "Approvers assigned",
    description:
      areas.length > 0
        ? `Approval areas: ${areas.join(", ")}`
        : `${approvalsInserted} approval(s) assigned`,
    metadata: { inserted: approvalsInserted, approval_areas: areas },
  });

  await auditLog(db, {
    orgId: change.org_id,
    actorId,
    action: "approvals_assigned",
    entityType: "change",
    entityId: body.changeEventId,
    metadata: { inserted: approvalsInserted },
  });

  // 6) AI suggested missing evidence (best-effort; skip when internal)
  let suggestEvidenceOk = false;
  if (!isInternal) {
  try {
    const seResp = await internalFetch(
      baseUrl,
      "/api/ai/suggest-evidence",
      cookie,
      { changeEventId: body.changeEventId }
    );
    suggestEvidenceOk = seResp.ok;
  } catch {
    suggestEvidenceOk = false;
  }
  }

  // 7) Compute ready status for response only (no blocking)
  let readyStatus: Awaited<ReturnType<typeof getReadyStatus>> | null = null;
  try {
    readyStatus = await getReadyStatus(db, {
      changeId: body.changeEventId,
    });
  } catch {
    readyStatus = null;
  }

  // 7.5) Ensure current Revenue Impact Report exists and is fresh before submission completes.
  // Non-fatal: change workflow should not hard-fail if report generation infrastructure has an issue.
  try {
    await runRevenueImpactGeneration({
      supabase: db,
      orgId: String(change.org_id),
      changeId: body.changeEventId,
      actorUserId: actorId || undefined,
      regenerate: false,
    });
  } catch {
    await auditLog(db, {
      orgId: String(change.org_id),
      actorId,
      action: "REVENUE_IMPACT_REPORT_FAILED",
      entityType: "change",
      entityId: body.changeEventId,
      metadata: { stage: "submit-precheck" },
    });
  }

  // 7.6) Ensure current Coordination Plan exists and is fresh before submission completes.
  try {
    const coordination = await runCoordinationPlanGeneration({
      supabase: db,
      orgId: String(change.org_id),
      changeId: body.changeEventId,
      actorUserId: actorId || undefined,
      regenerate: false,
    });
    const errorBlockers = coordination.saved.plan_json.blockers.filter(
      (b) => b.severity === "ERROR"
    );
    if (errorBlockers.length > 0) {
      return NextResponse.json(
        {
          error: "Coordination blockers must be resolved before submission",
          details: errorBlockers.map((b) => b.title),
        },
        { status: 400 }
      );
    }
  } catch {
    await auditLog(db, {
      orgId: String(change.org_id),
      actorId,
      action: "COORDINATION_PLAN_GENERATION_FAILED",
      entityType: "change",
      entityId: body.changeEventId,
      metadata: { stage: "submit-precheck" },
    });
  }

  // 7.7) Phase 5 — Unified governance before transition to IN_REVIEW
  let submitterRoleKeys: string[] | undefined;
  if (actorId) {
    const { data: gm } = await db
      .from("organization_members")
      .select("role")
      .eq("org_id", change.org_id)
      .eq("user_id", actorId)
      .maybeSingle();
    if (gm && (gm as { role?: string | null }).role) {
      submitterRoleKeys = [String((gm as { role: string }).role)];
    }
  }

  const {
    data: govDecision,
    policyContext: govPolicyCtx,
    error: govEvalErr,
  } = await evaluateGovernance(db, {
    orgId: change.org_id as string,
    environment: deploymentGovernanceEnvironment(),
    actor: {
      userId: actorId || undefined,
      actorType: isInternal ? "system" : "user",
      roleKeys: submitterRoleKeys,
    },
    target: {
      resourceType: "change",
      resourceId: body.changeEventId,
      transitionKey: "submit",
    },
    change: {
      changeId: body.changeEventId,
      domain: (change.domain as string | null) ?? undefined,
      riskLevel: (latestAssessment.risk_bucket as string | null) ?? undefined,
    },
    autonomy: { requestedMode: "ASSISTED" },
  });

  if (govEvalErr || !govDecision) {
    await auditLog(db, {
      orgId: change.org_id,
      actorId,
      action: "change_submit_governance_error",
      entityType: "change",
      entityId: body.changeEventId,
      metadata: { message: govEvalErr?.message ?? "no_decision" },
    });
    return NextResponse.json(
      { error: govEvalErr?.message ?? "Governance evaluation failed" },
      { status: 500 }
    );
  }

  if (govDecision.disposition === "BLOCK") {
    await auditLog(db, {
      orgId: change.org_id,
      actorId,
      action: "change_submit_blocked_governance",
      entityType: "change",
      entityId: body.changeEventId,
      metadata: {
        traceId: govDecision.traceId,
        reasonCodes: govDecision.reasonCodes,
      },
    });
    return NextResponse.json(
      {
        error: govDecision.explainability.headline,
        governance: {
          traceId: govDecision.traceId,
          disposition: govDecision.disposition,
          reasonCodes: govDecision.reasonCodes,
        },
      },
      { status: 403 }
    );
  }

  if (govDecision.disposition === "REQUIRE_APPROVAL") {
    if (!govPolicyCtx) {
      return NextResponse.json(
        { error: "Governance requires approval but context was not available" },
        { status: 500 }
      );
    }
    const { approvalRequestId, error: bindErr } = await bindGovernanceApprovalRequest(
      db,
      govDecision,
      govPolicyCtx,
      {
        createdByUserId: actorId || null,
        createdByType: isInternal ? "system" : "user",
      }
    );
    if (!approvalRequestId) {
      await auditLog(db, {
        orgId: change.org_id,
        actorId,
        action: "change_submit_approval_bind_failed",
        entityType: "change",
        entityId: body.changeEventId,
        metadata: { message: bindErr?.message },
      });
      return NextResponse.json(
        { error: bindErr?.message ?? "Could not create approval request for governed submit" },
        { status: 500 }
      );
    }
    await auditLog(db, {
      orgId: change.org_id,
      actorId,
      action: "change_submit_pending_governance_approval",
      entityType: "change",
      entityId: body.changeEventId,
      metadata: {
        approvalRequestId,
        governanceTraceId: govDecision.traceId,
      },
    });
    return NextResponse.json(
      {
        error: "Change submission requires approval under governance policy",
        approvalRequestId,
        governanceTraceId: govDecision.traceId,
      },
      { status: 202 }
    );
  }

  // 8) Update change_events to IN_REVIEW + SLA (then enqueue notifications)
  const { error: updErr } = await db
    .from("change_events")
    .update({
      status: "IN_REVIEW",
      submitted_at: submittedAt.toISOString(),
      due_at: dueAt?.toISOString() ?? null,
      sla_status: "ON_TRACK",
      escalated_at: null,
    })
    .eq("id", body.changeEventId);

  if (updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 });

  await auditLog(db, {
    orgId: change.org_id,
    actorId,
    action: "change_submitted",
    entityType: "change",
    entityId: body.changeEventId,
    metadata: {
      domain: change.domain ?? "REVENUE",
      risk_bucket: latestAssessment.risk_bucket ?? null,
      due_at: dueAt ? dueAt.toISOString() : null,
      pass_a_ok: passAOk,
      suggest_evidence_ok: suggestEvidenceOk,
    },
  });

  await addTimelineEvent({
    supabase: db,
    orgId: change.org_id,
    changeEventId: body.changeEventId,
    actorUserId: actorId || undefined,
    eventType: "CHANGE_SUBMITTED",
    title: "Change submitted for review",
    description: "Change submitted for approval",
    metadata: {
      status_before: change.status ?? "DRAFT",
      status_after: "IN_REVIEW",
      domain: change.domain ?? "REVENUE",
    },
  });

  await enqueueJiraIssuePropertySync(admin, change.org_id, body.changeEventId, {});
  await enqueueJiraCommentSync(admin, change.org_id, body.changeEventId, "approval_requested", {});

  await auditLog(db, {
    orgId: change.org_id,
    actorId,
    action: "sla_state_changed",
    entityType: "change",
    entityId: body.changeEventId,
    metadata: {
      previous_state: null,
      new_state: "ON_TRACK",
      due_at: dueAt ? dueAt.toISOString() : null,
    },
  });

  try {
    await recomputeAndPersistRevenueFields(admin, {
      changeId: body.changeEventId,
    });
  } catch {
    // Non-fatal
  }

  // 8) Notification outbox (enqueue IN_APP + enabled channels, deduped)
  // IMPORTANT: use `db` here so internal submits (no cookies) don't silently fail under RLS.
  const { data: settings } = await db
    .from("organization_settings")
    .select("slack_enabled, slack_webhook_url, email_enabled, notification_emails")
    .eq("org_id", change.org_id)
    .maybeSingle();

  const { data: slackInstall } = await db
    .from("slack_installations")
    .select("default_channel_id")
    .eq("org_id", change.org_id)
    .maybeSingle();

  const channels: Array<"IN_APP" | "SLACK" | "EMAIL"> = ["IN_APP"];

  if (slackInstall?.default_channel_id || (settings?.slack_enabled && settings?.slack_webhook_url))
    channels.push("SLACK");
  if (
    settings?.email_enabled &&
    Array.isArray(settings?.notification_emails) &&
    settings.notification_emails.length > 0
  ) {
    channels.push("EMAIL");
  }

  const dedupeWindowMinutes = 10;
  const dedupeKeys = channels.map(
    (ch) =>
      `approval_requested:${change.org_id}:${domainKey}:${body.changeEventId}:${ch}`
  );
  const since = new Date(
    Date.now() - dedupeWindowMinutes * 60 * 1000
  ).toISOString();

  const { data: existing } = await db
    .from("notification_outbox")
    .select("dedupe_key, created_at")
    .in("dedupe_key", dedupeKeys)
    .gte("created_at", since);

  const existingSet = new Set(
    (existing ?? []).map((x) => x.dedupe_key).filter(Boolean)
  );

  const payload = {
    changeEventId: body.changeEventId,
    title: (change as { title?: string }).title ?? null,
    risk_bucket: latestAssessment.risk_bucket,
    due_at: dueAt ? dueAt.toISOString() : null,
    submitted_at: submittedAt.toISOString(),
    pass_a_ok: passAOk,
    ai_pass_a_failed: !passAOk,
    suggest_evidence_ok: suggestEvidenceOk,
    ...(slackInstall?.default_channel_id
      ? { channelId: slackInstall.default_channel_id }
      : {}),
  };

  const rows = channels
    .map((ch) => {
      const dedupe_key = `approval_requested:${change.org_id}:${domainKey}:${body.changeEventId}:${ch}`;
      if (existingSet.has(dedupe_key)) return null;

      return {
        org_id: change.org_id,
        change_event_id: body.changeEventId,
        channel: ch,
        template_key: "approval_requested",
        payload,
        status: "PENDING",
        attempt_count: 0,
        last_error: null,
        available_at: new Date().toISOString(),
        dedupe_key,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (rows.length > 0) {
    const { error: outboxErr } = await db
      .from("notification_outbox")
      .insert(rows);
    if (outboxErr) {
      // best effort: don't fail the submit
    } else {
      try {
        await enqueueExecutiveDmNotifications(admin, {
          orgId: change.org_id,
          changeEventId: body.changeEventId,
          title: (change as { title?: string }).title ?? null,
          riskBucket: latestAssessment.risk_bucket as string | null,
        });
      } catch {
        // best effort
      }
    }
  }

  await enqueueNotificationEvents(db, {
    orgId: change.org_id,
    changeEventId: body.changeEventId,
    templateKey: "change_submitted",
    payload: {
      title: (change as { title?: string }).title ?? null,
      submitted_at: submittedAt.toISOString(),
    },
    dedupeKeyBase: `change_submitted:${body.changeEventId}`,
    channels: ["IN_APP", "SLACK", "EMAIL"],
  });

  if (rows.length > 0) {
    await auditLog(db, {
      orgId: change.org_id,
      actorId,
      action: "delivery_enqueued",
      entityType: "change",
      entityId: body.changeEventId,
      metadata: {
        template_key: "approval_requested",
        channels,
        inserted: rows.length,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    alreadySubmitted: false,
    risk_bucket: latestAssessment.risk_bucket,
    due_at: dueAt ? dueAt.toISOString() : null,
    pass_a_ok: passAOk,
    suggest_evidence_ok: suggestEvidenceOk,
    readyStatus: readyStatus ?? undefined,
  });
}
