/**
 * Sync Solvren governance status to Jira via Issue Property API.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureValidJiraToken } from "./jiraAuthService";
import { jiraPut } from "@/lib/jira/client";
import { buildChangeUrl } from "./jiraSyncService";
import { getReadyStatus } from "@/services/risk/readyStatus";

const PROPERTY_KEY = "revenueguard_status";

export async function syncJiraIssueProperty(
  orgId: string,
  changeEventId: string,
  jiraIssueId: string
): Promise<void> {
  const admin = createAdminClient();
  const creds = await ensureValidJiraToken(admin, orgId);
  if (!creds) throw new Error("No valid Jira credentials");

  const { data: conn } = await admin
    .from("integration_connections")
    .select("config")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const cfg = conn as { config?: { cloudId?: string; features?: { issuePropertySync?: boolean } } } | null;
  if (!cfg?.config?.features?.issuePropertySync) return;
  const cloudId = cfg.config.cloudId;
  if (!cloudId) throw new Error("Missing cloudId");

  const { data: change } = await admin
    .from("change_events")
    .select("id, status, revenue_risk_score, base_risk_score")
    .eq("id", changeEventId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!change) return;

  const c = change as { status?: string; revenue_risk_score?: number; base_risk_score?: number };
  const score = c.revenue_risk_score ?? c.base_risk_score ?? 0;
  const riskLabel = score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";

  const { count: ar } = await admin
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("change_event_id", changeEventId);
  const { count: ac } = await admin
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("change_event_id", changeEventId)
    .eq("decision", "APPROVED");

  let evidenceComplete = false;
  try {
    const ready = await getReadyStatus(admin, { changeId: changeEventId });
    evidenceComplete = (ready.missingEvidence?.length ?? 0) === 0;
  } catch {
    // If ready status fails (e.g. no assessment), keep false
  }

  const payload = {
    version: 1,
    changeId: changeEventId.slice(0, 8),
    changeUuid: changeEventId,
    status: c.status ?? "DRAFT",
    riskScore: score,
    riskLabel,
    approvalsRequired: ar ?? 0,
    approvalsComplete: ac ?? 0,
    evidenceComplete,
    lastSyncedAt: new Date().toISOString(),
    url: buildChangeUrl(changeEventId),
  };

  await jiraPut(
    cloudId,
    creds.accessToken,
    `/issue/${jiraIssueId}/properties/${PROPERTY_KEY}`,
    payload
  );
}
