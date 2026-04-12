/**
 * Phase 2 internal onboarding aggregation (Resolution Appendix §5–§6).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { onboardingPhaseSummaryFromState } from "@/lib/internal/onboardingPhaseSummary";
import { listCanonicalIntegrations } from "./integrationsReadModel";

export type ChecklistItemStatus = "not_started" | "in_progress" | "complete" | "blocked" | "unknown";
export type ChecklistItemMode = "system_derived" | "manually_overridable";

export const MANUAL_OVERRIDE_KEYS = new Set(["first_issue_detected", "workflow_route_available"]);

export type InternalChecklistItem = {
  key: string;
  label: string;
  status: ChecklistItemStatus;
  mode: ChecklistItemMode;
  lastUpdatedAt: string | null;
  source: string;
  details: string | null;
};

type Blocker = { code: string; label: string };

function maxIso(...xs: (string | null | undefined)[]): string | null {
  const ts = xs.filter(Boolean).map((x) => new Date(x!).getTime());
  if (ts.length === 0) return null;
  return new Date(Math.max(...ts)).toISOString();
}

async function latestOverrides(admin: SupabaseClient, orgId: string): Promise<Map<string, { status: string; created_at: string }>> {
  const { data } = await admin
    .from("internal_onboarding_overrides")
    .select("item_key, status, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  const map = new Map<string, { status: string; created_at: string }>();
  for (const row of data ?? []) {
    const k = String((row as { item_key: string }).item_key);
    if (!map.has(k)) map.set(k, { status: String((row as { status: string }).status), created_at: String((row as { created_at: string }).created_at) });
  }
  return map;
}

export async function buildInternalOnboardingPayload(admin: SupabaseClient, orgId: string) {
  const [
    { data: obState },
    { data: steps },
    { data: settings },
    { data: billing },
    { count: memberCount },
    { count: inviteCount },
    { count: issueCount },
    { count: policyCount },
    { count: notifPrefCount },
  ] = await Promise.all([
    admin.from("org_onboarding_states").select("*").eq("org_id", orgId).maybeSingle(),
    admin.from("org_onboarding_steps").select("*").eq("org_id", orgId).order("step_key", { ascending: true }),
    admin.from("organization_settings").select("*").eq("org_id", orgId).maybeSingle(),
    admin.from("billing_accounts").select("plan_key, status, updated_at").eq("org_id", orgId).maybeSingle(),
    admin.from("organization_members").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("org_invites").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("issues").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("policies").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    admin.from("org_notification_preferences").select("*", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  const members = memberCount ?? 0;
  const invites = inviteCount ?? 0;
  const issues = issueCount ?? 0;
  const policies = policyCount ?? 0;
  const notifPrefs = notifPrefCount ?? 0;

  const { items: intItems } = await listCanonicalIntegrations(admin, orgId);
  const anyConnected = intItems.some((i) => i.connectionStatus === "connected" && !i.disabled);
  const anySyncOk = intItems.some((i) => i.lastSuccessAt != null);

  const settingsRow = settings as Record<string, unknown> | null;
  const emails = (settingsRow?.notification_emails as string[] | null) ?? [];
  const primaryEmail = (settingsRow?.primary_notification_email as string | null) ?? null;
  const billingEmail = primaryEmail ?? emails[0] ?? null;

  const orgProfileOk = Boolean(settingsRow && (settingsRow as { org_id?: string }).org_id);
  const billingOk = Boolean(billing);
  const teammateOk = members > 1 || invites > 0;
  const notifDestOk = notifPrefs > 0 || emails.length > 0 || Boolean(primaryEmail);

  const overrideMap = await latestOverrides(admin, orgId);

  const checklist: InternalChecklistItem[] = [
    {
      key: "org_profile_configured",
      label: "Organization profile configured",
      status: orgProfileOk ? "complete" : "not_started",
      mode: "system_derived",
      lastUpdatedAt: (settingsRow?.updated_at as string) ?? null,
      source: "organization_settings",
      details: null,
    },
    {
      key: "billing_configured",
      label: "Billing configured",
      status: billingOk ? "complete" : "not_started",
      mode: "system_derived",
      lastUpdatedAt: (billing as { updated_at?: string } | null)?.updated_at ?? null,
      source: "billing_accounts",
      details: null,
    },
    {
      key: "first_teammate_invited",
      label: "First teammate invited",
      status: teammateOk ? "complete" : "not_started",
      mode: "system_derived",
      lastUpdatedAt: null,
      source: "organization_members/org_invites",
      details: null,
    },
    {
      key: "notification_destination_configured",
      label: "Notification destination configured",
      status: notifDestOk ? "complete" : "not_started",
      mode: "system_derived",
      lastUpdatedAt: null,
      source: "organization_settings/org_notification_preferences",
      details: null,
    },
    {
      key: "first_integration_connected",
      label: "First integration connected",
      status: anyConnected ? "complete" : "not_started",
      mode: "system_derived",
      lastUpdatedAt: null,
      source: "integration_accounts",
      details: null,
    },
    {
      key: "first_sync_successful",
      label: "First data sync successful",
      status: anySyncOk ? "complete" : "not_started",
      mode: "system_derived",
      lastUpdatedAt: null,
      source: "integration_accounts",
      details: null,
    },
    {
      key: "first_issue_detected",
      label: "First issue detected",
      status: issues > 0 ? "complete" : "not_started",
      mode: "manually_overridable",
      lastUpdatedAt: null,
      source: "issues",
      details: null,
    },
    {
      key: "workflow_route_available",
      label: "Workflow route available",
      status: policies > 0 ? "complete" : "not_started",
      mode: "manually_overridable",
      lastUpdatedAt: null,
      source: "policies",
      details: null,
    },
  ];

  for (const it of checklist) {
    if (!MANUAL_OVERRIDE_KEYS.has(it.key)) continue;
    const o = overrideMap.get(it.key);
    if (o && o.status === "complete") {
      it.status = "complete";
      it.lastUpdatedAt = o.created_at;
      it.source = "internal_onboarding_overrides";
    }
  }

  const blockers: Blocker[] = [];
  if (!anyConnected) blockers.push({ code: "NO_INTEGRATIONS_CONNECTED", label: "No integrations connected" });
  if (members <= 1) blockers.push({ code: "NO_ADDITIONAL_MEMBERS", label: "No active members besides owner" });
  if (!notifDestOk) blockers.push({ code: "NOTIFICATION_ROUTE_MISSING", label: "Notification route missing" });
  if (!billingOk) blockers.push({ code: "BILLING_INCOMPLETE", label: "Billing incomplete" });

  const stepRows = (steps ?? []) as Array<Record<string, unknown>>;
  const completed = stepRows.filter((s) => String(s.step_status).toUpperCase() === "COMPLETED").length;
  const total = stepRows.length;
  let percentComplete = total > 0 ? Math.round((completed / Math.max(total, 1)) * 100) : 0;
  if (total === 0 && obState) {
    const p1 = String((obState as { guided_phase1_status?: string }).guided_phase1_status ?? "");
    const done = p1 === "COMPLETED" || p1 === "SKIPPED" ? 1 : 0;
    percentComplete = Math.round((done / 4) * 100);
  }

  const guidedKey =
    (obState as { guided_current_step_key?: string | null })?.guided_current_step_key ??
    (obState as { current_step_key?: string | null })?.current_step_key ??
    null;
  let currentStepKey = guidedKey;
  if (!currentStepKey && stepRows.length > 0) {
    const next = stepRows.find((s) => String(s.step_status).toUpperCase() !== "COMPLETED");
    currentStepKey = next ? String(next.step_key) : null;
  }
  const stepMatch = stepRows.find((s) => String(s.step_key) === currentStepKey);
  const currentStepLabel = stepMatch
    ? String((stepMatch as { display_name?: string }).display_name ?? currentStepKey ?? "")
    : currentStepKey
      ? String(currentStepKey).replace(/_/g, " ")
      : "—";

  const lastUpdatedAt = maxIso(
    (obState as { updated_at?: string } | null)?.updated_at,
    ...stepRows.map((s) => s.updated_at as string | undefined)
  );

  const onboardingPhaseSummary = onboardingPhaseSummaryFromState((obState ?? null) as Parameters<typeof onboardingPhaseSummaryFromState>[0]);

  return {
    onboardingPhaseSummary,
    percentComplete,
    currentStepKey: currentStepKey ?? null,
    currentStepLabel,
    lastUpdatedAt: lastUpdatedAt ?? new Date().toISOString(),
    items: checklist,
    blockers,
    settingsSummary: {
      billingEmail: billingEmail ?? null,
      notificationEmails: emails.length ? emails : primaryEmail ? [primaryEmail] : [],
      timezone: (settingsRow?.timezone as string | null) ?? null,
    },
  };
}
