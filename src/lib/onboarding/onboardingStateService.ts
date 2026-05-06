/**
 * Phase 5 — org-level onboarding state machine (DB source of truth).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingStep } from "./onboardingSteps";
import { ONBOARDING_STEPS } from "./onboardingSteps";
import { logProductEventAsync } from "@/lib/telemetry/productEvents";

export type { OnboardingStep };
export { ONBOARDING_STEPS };

const QUALIFYING_ACTIONS = ["acknowledge", "assign", "approve"];

export async function ensureOnboardingStateRow(admin: SupabaseClient, orgId: string): Promise<void> {
  const { data: existing } = await admin.from("onboarding_state").select("org_id").eq("org_id", orgId).maybeSingle();
  if (existing) return;
  await admin.from("onboarding_state").insert({
    org_id: orgId,
    current_step: "CONNECT_INTEGRATION",
    completed_steps: [],
  });
}

async function hasConnectedRevenueIntegration(admin: SupabaseClient, orgId: string): Promise<boolean> {
  const { count } = await admin
    .from("integration_connections")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "connected")
    .in("provider", ["stripe", "hubspot", "salesforce"]);
  return (count ?? 0) > 0;
}

async function countDetectorIssues(admin: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await admin
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("source_type", "detector");
  return count ?? 0;
}

async function hasQualifyingIssueAction(admin: SupabaseClient, orgId: string): Promise<boolean> {
  const { data: issues } = await admin.from("issues").select("id").eq("org_id", orgId);
  const ids = ((issues ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return false;
  const { count } = await admin
    .from("issue_actions")
    .select("id", { count: "exact", head: true })
    .in("issue_id", ids)
    .in("action_type", QUALIFYING_ACTIONS);
  return (count ?? 0) > 0;
}

async function hasResolvedIssue(admin: SupabaseClient, orgId: string): Promise<boolean> {
  const { count } = await admin
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["resolved", "verified"]);
  return (count ?? 0) > 0;
}

function nextStepFromFacts(input: {
  connected: boolean;
  issueCount: number;
  insightsDone: boolean;
  hasAction: boolean;
  hasResolved: boolean;
}): OnboardingStep {
  if (!input.connected) return "CONNECT_INTEGRATION";
  if (input.issueCount === 0) return "ANALYZING";
  if (!input.insightsDone) return "FIRST_INSIGHTS";
  if (!input.hasAction) return "FIRST_ACTION";
  if (!input.hasResolved) return "FIRST_RESOLUTION";
  return "COMPLETE";
}

export async function recomputeOnboardingState(admin: SupabaseClient, orgId: string): Promise<OnboardingStep> {
  await ensureOnboardingStateRow(admin, orgId);
  const { data: row } = await admin.from("onboarding_state").select("*").eq("org_id", orgId).maybeSingle();
  if (!row) return "CONNECT_INTEGRATION";

  const r = row as {
    current_step: string;
    completed_steps: string[] | null;
    completed_at: string | null;
  };
  if (r.current_step === "COMPLETE" || r.completed_at) {
    return "COMPLETE";
  }

  const completed = Array.from(new Set(r.completed_steps ?? []));
  const insightsDone = completed.includes("FIRST_INSIGHTS");

  const connected = await hasConnectedRevenueIntegration(admin, orgId);
  const issueCount = await countDetectorIssues(admin, orgId);
  const hasAction = await hasQualifyingIssueAction(admin, orgId);
  const hasResolved = await hasResolvedIssue(admin, orgId);

  const next = nextStepFromFacts({
    connected,
    issueCount,
    insightsDone,
    hasAction,
    hasResolved,
  });

  const patch: Record<string, unknown> = {
    current_step: next,
    completed_at: next === "COMPLETE" ? new Date().toISOString() : null,
  };
  if (next === "COMPLETE" && !completed.includes("COMPLETE")) {
    patch.completed_steps = [...completed, "COMPLETE"];
  }

  await admin.from("onboarding_state").update(patch).eq("org_id", orgId);

  if (next === "COMPLETE") {
    logProductEventAsync(admin, {
      event: "onboarding_step_completed",
      orgId,
      metadata: { step: "COMPLETE" },
    });
  }

  return next;
}

export async function markFirstInsightsComplete(
  admin: SupabaseClient,
  orgId: string
): Promise<{ ok: true; step: OnboardingStep } | { ok: false; error: string }> {
  await ensureOnboardingStateRow(admin, orgId);
  const { data: row } = await admin.from("onboarding_state").select("completed_steps").eq("org_id", orgId).maybeSingle();
  const completed = ((row as { completed_steps?: string[] } | null)?.completed_steps ?? []) as string[];
  if (completed.includes("FIRST_INSIGHTS")) {
    const s = await recomputeOnboardingState(admin, orgId);
    return { ok: true, step: s };
  }
  const nextCompleted = [...completed, "FIRST_INSIGHTS"];
  await admin
    .from("onboarding_state")
    .update({
      completed_steps: nextCompleted,
      current_step: "FIRST_ACTION",
    })
    .eq("org_id", orgId);

  logProductEventAsync(admin, {
    event: "onboarding_step_completed",
    orgId,
    metadata: { step: "FIRST_INSIGHTS" },
  });

  const step = await recomputeOnboardingState(admin, orgId);
  return { ok: true, step };
}

export async function getOnboardingState(admin: SupabaseClient, orgId: string) {
  await ensureOnboardingStateRow(admin, orgId);
  const { data } = await admin.from("onboarding_state").select("*").eq("org_id", orgId).maybeSingle();
  return data as
    | {
        org_id: string;
        current_step: string;
        completed_steps: string[];
        started_at: string;
        completed_at: string | null;
        initial_detection_triggered_at: string | null;
      }
    | null;
}

export function onboardingBlocksIssueActions(step: string, completedSteps: string[]): boolean {
  return step === "FIRST_INSIGHTS" && !completedSteps.includes("FIRST_INSIGHTS");
}
