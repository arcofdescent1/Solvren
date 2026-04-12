/**
 * Phase 3 — expansion recommendations (integrations + workflows not yet enabled).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDetectorConfig } from "@/modules/detection/persistence/detector-configs.repository";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import {
  WORKFLOW_SOURCE_TEMPLATE_KEYS,
  WORKFLOW_TEMPLATE_TO_DETECTOR_KEY,
  WORKFLOW_CARD_COPY,
  type WorkflowSourceTemplateKey,
} from "@/modules/onboarding/phase2/workflow-templates";

export type Phase3RecommendationItem = {
  kind: "integration" | "workflow";
  key: string;
  providerName: string;
  category: string;
  estimatedSetupMinutes: number;
  expectedValue: string;
  ctaLabel: string;
  ctaHref: string;
  peerHint: string;
};

const INTEGRATION_RECS: Phase3RecommendationItem[] = [
    {
      kind: "integration",
      key: "hubspot",
      providerName: "HubSpot",
      category: "CRM",
      estimatedSetupMinutes: 20,
      expectedValue: "Tighter revenue ↔ CRM attribution for forecast and leakage signals.",
      ctaLabel: "Connect HubSpot",
      ctaHref: "/integrations/hubspot",
      peerHint: "Most RevOps-led teams also connect HubSpot or Salesforce for CRM-backed detection.",
    },
    {
      kind: "integration",
      key: "salesforce",
      providerName: "Salesforce",
      category: "CRM",
      estimatedSetupMinutes: 25,
      expectedValue: "Executive-ready pipeline and forecast context inside Solvren.",
      ctaLabel: "Connect Salesforce",
      ctaHref: "/integrations/salesforce",
      peerHint: "Most customers like you also connect Salesforce for opportunity hygiene alerts.",
    },
    {
      kind: "integration",
      key: "jira",
      providerName: "Jira",
      category: "Delivery / ticketing",
      estimatedSetupMinutes: 15,
      expectedValue: "Link revenue-impacting work to engineering execution and approvals.",
      ctaLabel: "Connect Jira",
      ctaHref: "/integrations/jira",
      peerHint: "Operations teams often add Jira so change risk ties to delivery reality.",
    },
    {
      kind: "integration",
      key: "slack",
      providerName: "Slack",
      category: "Collaboration",
      estimatedSetupMinutes: 10,
      expectedValue: "Route alerts and executive summaries where teams already work.",
      ctaLabel: "Connect Slack",
      ctaHref: "/integrations/slack",
      peerHint: "Slack is the fastest path to cross-team visibility after email.",
    },
    {
      kind: "integration",
      key: "stripe",
      providerName: "Stripe",
      category: "Finance / billing",
      estimatedSetupMinutes: 12,
      expectedValue: "Surface payment distress and recurring revenue risk early.",
      ctaLabel: "Connect Stripe",
      ctaHref: "/integrations/stripe",
      peerHint: "Finance and RevOps teams usually connect billing for revenue-at-risk context.",
    },
  ];

export async function listPhase3Recommendations(
  admin: SupabaseClient,
  orgId: string
): Promise<Phase3RecommendationItem[]> {
  const { data: conns } = await admin
    .from("integration_connections")
    .select("provider, status")
    .eq("org_id", orgId)
    .eq("status", "connected");
  const connected = new Set((conns ?? []).map((r) => String((r as { provider: string }).provider).toLowerCase()));

  const out: Phase3RecommendationItem[] = [];

  for (const rec of INTEGRATION_RECS) {
    if (!connected.has(rec.key.toLowerCase())) {
      out.push(rec);
    }
  }

  for (const key of WORKFLOW_SOURCE_TEMPLATE_KEYS) {
    const dk = WORKFLOW_TEMPLATE_TO_DETECTOR_KEY[key as WorkflowSourceTemplateKey];
    const { data: def } = await getDetectorDefinitionByKey(admin, dk);
    if (!def) continue;
    const { data: cfg } = await getDetectorConfig(admin, orgId, def.id);
    if (cfg?.enabled) continue;
    const copy = WORKFLOW_CARD_COPY[key as WorkflowSourceTemplateKey];
    out.push({
      kind: "workflow",
      key,
      providerName: copy.title,
      category: "Monitoring workflow",
      estimatedSetupMinutes: 5,
      expectedValue: copy.impact,
      ctaLabel: "Enable workflow",
      ctaHref: "/onboarding/activation",
      peerHint: "Teams that enable 3+ workflows see faster time-to-first prevented incident.",
    });
  }

  return out;
}
