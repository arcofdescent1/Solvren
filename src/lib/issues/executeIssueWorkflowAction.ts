import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateApprovalAction,
  validateSystemVerifiedTransition,
  validateTransition,
} from "./issueStateService";
import type { ApprovalState, IssueWorkflowStatus } from "./issuePhase2Types";
import { normalizeIssueWorkflowStatus } from "./issuePhase2Types";
import { recordIssueDecision, type DecisionSource } from "./recordIssueDecision";
import { captureBaselineAtResolve } from "./verification/baselineCapture";
import { hasVerificationRule } from "./verification/canonicalRuleKey";
import { getOnboardingState, onboardingBlocksIssueActions } from "@/lib/onboarding/onboardingStateService";
import { assertIssueMutationAllowedByOnboarding } from "@/lib/onboarding/issueMutationOnboarding";
import { logProductEventAsync } from "@/lib/telemetry/productEvents";
import { revalidateExecutiveCache } from "@/lib/executive/executivePhase5Cache";

export type IssueWorkflowActionType =
  | "acknowledge"
  | "dismiss"
  | "assign"
  | "approve"
  | "deny"
  | "request_changes"
  | "mark_in_progress"
  | "resolve"
  | "reopen"
  | "verify";

export type ExecuteIssuePayload = {
  note?: string | null;
  ownerEmail?: string | null;
  ownerDisplayName?: string | null;
};

function parseApproval(raw: string | null | undefined): ApprovalState {
  const s = String(raw ?? "not_required");
  if (
    s === "not_required" ||
    s === "pending" ||
    s === "approved" ||
    s === "denied" ||
    s === "changes_requested"
  ) {
    return s;
  }
  return "not_required";
}

/**
 * Single entry for issue workflow mutations (app, email token, Slack job).
 * Operates on `public.issues` Phase 2 columns.
 */
export async function executeIssueWorkflowAction(
  admin: SupabaseClient,
  args: {
    issueId: string;
    actorUserId: string | null;
    actorEmail: string | null;
    actorDisplayName: string | null;
    source: DecisionSource;
    action: IssueWorkflowActionType;
    payload?: ExecuteIssuePayload;
    /** When true, skip status transition validation (approval-only updates). */
    systemVerified?: boolean;
  }
): Promise<{ ok: true; previousStatus: IssueWorkflowStatus; newStatus: IssueWorkflowStatus } | { ok: false; error: string }> {
  const payload = args.payload ?? {};
  const { data: issue, error: loadErr } = await admin
    .from("issues")
    .select(
      "id, org_id, issue_key, status, approval_state, owner_email, owner_display_name, detection_type, detection_metadata, affected_count, revenue_impact_cents"
    )
    .eq("id", args.issueId)
    .maybeSingle();

  if (loadErr || !issue) return { ok: false, error: "Issue not found" };

  const issueCtx = {
    issue_key: String((issue as { issue_key?: string }).issue_key ?? ""),
    org_id: String((issue as { org_id: string }).org_id),
  };

  const prev = normalizeIssueWorkflowStatus(String((issue as { status?: string }).status ?? "detected"));
  const approval = parseApproval((issue as { approval_state?: string }).approval_state as string);
  const now = new Date().toISOString();

  const onboardingGateActions = new Set<IssueWorkflowActionType>([
    "acknowledge",
    "assign",
    "approve",
    "mark_in_progress",
    "resolve",
  ]);
  const orgId = (issue as { org_id: string }).org_id;
  if (onboardingGateActions.has(args.action)) {
    const os = await getOnboardingState(admin, orgId);
    if (os && onboardingBlocksIssueActions(os.current_step, os.completed_steps ?? [])) {
      return { ok: false, error: "Complete the onboarding insights step before acting on issues." };
    }
  }
  if (args.action === "assign") {
    const om = await assertIssueMutationAllowedByOnboarding(admin, orgId, "assign");
    if (!om.ok) return { ok: false, error: om.error };
  }
  if (args.action === "resolve") {
    const om = await assertIssueMutationAllowedByOnboarding(admin, orgId, "resolve");
    if (!om.ok) return { ok: false, error: om.error };
  }

  const baseRow = {
    updated_at: now,
  };

  const run = async (
    newStatus: IssueWorkflowStatus,
    nextApproval: ApprovalState,
    actionType: string,
    extra?: Record<string, unknown>
  ) => {
    const up: Record<string, unknown> = {
      ...baseRow,
      status: newStatus,
      approval_state: nextApproval,
    };
    if (payload.ownerEmail !== undefined) {
      up.owner_email = payload.ownerEmail;
    }
    if (payload.ownerDisplayName !== undefined) {
      up.owner_display_name = payload.ownerDisplayName;
    }
    Object.assign(up, extra ?? {});

    const { error: upErr } = await admin.from("issues").update(up).eq("id", args.issueId);
    if (upErr) return { ok: false as const, error: upErr.message };

    const rec = await recordIssueDecision(admin, {
      issueId: args.issueId,
      actionType,
      previousStatus: prev,
      newStatus,
      source: args.source,
      actorUserId: args.actorUserId,
      actorEmail: args.actorEmail,
      actorDisplayName: args.actorDisplayName,
      payload: { note: payload.note ?? null, ...issueCtx, ...(extra ?? {}) },
    });
    if (!rec.ok) return { ok: false as const, error: rec.error };

    return { ok: true as const, previousStatus: prev, newStatus };
  };

  switch (args.action) {
    case "acknowledge": {
      if (prev === "acknowledged") {
        return { ok: true, previousStatus: prev, newStatus: prev };
      }
      const v = validateTransition({
        fromStatus: prev,
        toStatus: "acknowledged",
        approvalState: approval,
      });
      if (!v.ok) return { ok: false, error: v.error };
      const res = await run("acknowledged", approval, "acknowledge");
      if (!res.ok) return res;
      logProductEventAsync(admin, {
        event: "issue_action",
        orgId,
        userId: args.actorUserId,
        issueId: args.issueId,
        metadata: { action: "acknowledge" },
      });
      revalidateExecutiveCache(orgId);
      return res;
    }

    case "dismiss": {
      const nextApproval: ApprovalState = approval === "pending" ? "denied" : approval;
      const v = validateTransition({
        fromStatus: prev,
        toStatus: "dismissed",
        approvalState: approval,
        nextApproval,
      });
      if (!v.ok) return { ok: false, error: v.error };
      return run("dismissed", nextApproval, "dismiss");
    }

    case "assign": {
      const ownerEmail = payload.ownerEmail?.trim() || null;
      const ownerDisplay = payload.ownerDisplayName?.trim() || null;
      if (!ownerEmail) return { ok: false, error: "ownerEmail is required" };

      const v = validateTransition({
        fromStatus: prev,
        toStatus: "assigned",
        approvalState: approval,
      });
      if (!v.ok) return { ok: false, error: v.error };

      const { error: upErr } = await admin
        .from("issues")
        .update({
          ...baseRow,
          status: "assigned",
          owner_email: ownerEmail,
          owner_display_name: ownerDisplay,
        })
        .eq("id", args.issueId);
      if (upErr) return { ok: false, error: upErr.message };

      const rec = await recordIssueDecision(admin, {
        issueId: args.issueId,
        actionType: "assign",
        previousStatus: prev,
        newStatus: "assigned",
        source: args.source,
        actorUserId: args.actorUserId,
        actorEmail: args.actorEmail,
        actorDisplayName: args.actorDisplayName,
        payload: { note: payload.note ?? null, ...issueCtx, ownerEmail, ownerDisplayName: ownerDisplay },
      });
      if (!rec.ok) return { ok: false, error: rec.error };
      logProductEventAsync(admin, {
        event: "issue_action",
        orgId,
        userId: args.actorUserId,
        issueId: args.issueId,
        metadata: { action: "assign" },
      });
      revalidateExecutiveCache(orgId);
      return { ok: true, previousStatus: prev, newStatus: "assigned" };
    }

    case "approve": {
      const va = validateApprovalAction({ action: "approve", approvalState: approval });
      if (!va.ok) return { ok: false, error: va.error };
      const nextApproval: ApprovalState = "approved";
      const { error: upErr } = await admin
        .from("issues")
        .update({
          ...baseRow,
          approval_state: nextApproval,
        })
        .eq("id", args.issueId);
      if (upErr) return { ok: false, error: upErr.message };
      const rec = await recordIssueDecision(admin, {
        issueId: args.issueId,
        actionType: "approve",
        previousStatus: prev,
        newStatus: prev,
        source: args.source,
        actorUserId: args.actorUserId,
        actorEmail: args.actorEmail,
        actorDisplayName: args.actorDisplayName,
        payload: { note: payload.note ?? null, ...issueCtx },
      });
      if (!rec.ok) return { ok: false, error: rec.error };
      return { ok: true, previousStatus: prev, newStatus: prev };
    }

    case "deny": {
      const va = validateApprovalAction({ action: "deny", approvalState: approval });
      if (!va.ok) return { ok: false, error: va.error };
      const nextApproval: ApprovalState = "denied";
      const v = validateTransition({
        fromStatus: prev,
        toStatus: "dismissed",
        approvalState: approval,
        nextApproval,
      });
      if (!v.ok) return { ok: false, error: v.error };
      return run("dismissed", nextApproval, "deny");
    }

    case "request_changes": {
      const va = validateApprovalAction({ action: "request_changes", approvalState: approval });
      if (!va.ok) return { ok: false, error: va.error };
      const nextApproval: ApprovalState = "changes_requested";
      const { error: upErr } = await admin
        .from("issues")
        .update({
          ...baseRow,
          approval_state: nextApproval,
        })
        .eq("id", args.issueId);
      if (upErr) return { ok: false, error: upErr.message };
      const rec = await recordIssueDecision(admin, {
        issueId: args.issueId,
        actionType: "request_changes",
        previousStatus: prev,
        newStatus: prev,
        source: args.source,
        actorUserId: args.actorUserId,
        actorEmail: args.actorEmail,
        actorDisplayName: args.actorDisplayName,
        payload: { note: payload.note ?? null, ...issueCtx },
      });
      if (!rec.ok) return { ok: false, error: rec.error };
      return { ok: true, previousStatus: prev, newStatus: prev };
    }

    case "mark_in_progress": {
      const v = validateTransition({
        fromStatus: prev,
        toStatus: "in_progress",
        approvalState: approval,
      });
      if (!v.ok) return { ok: false, error: v.error };
      return run("in_progress", approval, "mark_in_progress");
    }

    case "resolve": {
      const v = validateTransition({
        fromStatus: prev,
        toStatus: "resolved",
        approvalState: approval,
      });
      if (!v.ok) return { ok: false, error: v.error };
      const wantsVerify = hasVerificationRule(String((issue as { detection_type?: string }).detection_type ?? ""));
      const cap = await captureBaselineAtResolve(admin, {
        org_id: orgId,
        detection_type: (issue as { detection_type?: string | null }).detection_type ?? null,
        affected_count: (issue as { affected_count?: number | null }).affected_count ?? null,
        revenue_impact_cents: (issue as { revenue_impact_cents?: number | null }).revenue_impact_cents ?? null,
      });
      const dm = ((issue as { detection_metadata?: Record<string, unknown> }).detection_metadata ??
        {}) as Record<string, unknown>;
      const mergeMeta = {
        ...dm,
        phase4_baseline: cap.phase4_baseline,
      };
      const res = await run("resolved", approval, "resolve", {
        resolved_at: now,
        verification_status: wantsVerify ? "pending" : "not_required",
        baseline_value: cap.baselineValue,
        detection_metadata: mergeMeta,
      });
      if (!res.ok) return res;
      logProductEventAsync(admin, {
        event: "issue_action",
        orgId,
        userId: args.actorUserId,
        issueId: args.issueId,
        metadata: { action: "resolve" },
      });
      logProductEventAsync(admin, {
        event: "issue_resolved",
        orgId,
        userId: args.actorUserId,
        issueId: args.issueId,
        metadata: {},
      });
      revalidateExecutiveCache(orgId);
      return res;
    }

    case "reopen": {
      const v = validateTransition({
        fromStatus: prev,
        toStatus: "reopened",
        approvalState: approval,
      });
      if (!v.ok) return { ok: false, error: v.error };
      const wantsVerify = hasVerificationRule(String((issue as { detection_type?: string }).detection_type ?? ""));
      return run("reopened", approval, "reopen", {
        resolved_at: null,
        verified_at: null,
        verification_status: wantsVerify ? "pending" : "not_required",
        post_fix_value: null,
        actual_roi_cents: null,
      });
    }

    case "verify": {
      if (!args.systemVerified) {
        return { ok: false, error: "Verified transition is system-only" };
      }
      const v = validateSystemVerifiedTransition({
        fromStatus: prev,
        toStatus: "verified",
        approvalState: approval,
      });
      if (!v.ok) return { ok: false, error: v.error };
      return run("verified", approval, "verify");
    }

    default:
      return { ok: false, error: "Unknown action" };
  }
}
