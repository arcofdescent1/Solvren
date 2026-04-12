/**
 * Guided Phase 1 — normalize integration_accounts into onboarding presentation cards.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import type { IntegrationAccountRow } from "@/modules/integrations/core/integrationAccountsRepo";
import type { OnboardingIntegrationPresentationStatus } from "../domain/guided-phase1";
import {
  type OnboardingProviderKey,
  ONBOARDING_PROVIDER_KEYS,
} from "../domain/guided-phase1";

export type OnboardingIntegrationCard = {
  provider: OnboardingProviderKey;
  label: string;
  category: "crm" | "payments" | "communication" | "engineering";
  status: OnboardingIntegrationPresentationStatus;
  connectedAt?: string | null;
  setupMinutes?: number;
  valueSummary: string;
  detectsSummary: string;
};

const META: Record<
  OnboardingProviderKey,
  {
    label: string;
    category: OnboardingIntegrationCard["category"];
    setupMinutes: number;
    valueSummary: string;
    detectsSummary: string;
    connectMode: "oauth_post" | "assisted" | "settings";
  }
> = {
  hubspot: {
    label: "HubSpot",
    category: "crm",
    setupMinutes: 5,
    valueSummary: "Surface CRM hygiene and revenue leakage in your funnel.",
    detectsSummary: "Duplicates, ownership gaps, and lifecycle inconsistencies.",
    connectMode: "oauth_post",
  },
  salesforce: {
    label: "Salesforce",
    category: "crm",
    setupMinutes: 20,
    valueSummary: "Prioritize Salesforce revenue and operational risk.",
    detectsSummary: "Lead routing, data quality, and handoff failures.",
    connectMode: "assisted",
  },
  stripe: {
    label: "Stripe",
    category: "payments",
    setupMinutes: 5,
    valueSummary: "Quantify failed payments and subscription revenue at risk.",
    detectsSummary: "Failed charges, churn signals, and billing anomalies.",
    connectMode: "settings",
  },
  slack: {
    label: "Slack",
    category: "communication",
    setupMinutes: 5,
    valueSummary: "Catch coordination breakdowns where work actually happens.",
    detectsSummary: "Missed handoffs, stalled threads, and routing gaps.",
    connectMode: "oauth_post",
  },
  jira: {
    label: "Jira",
    category: "engineering",
    setupMinutes: 10,
    valueSummary: "Link delivery risk to revenue-impacting incidents.",
    detectsSummary: "Broken automation, backlog risk, and delivery delays.",
    connectMode: "oauth_post",
  },
};

function mapAccountStatus(status: IntegrationAccountRow["status"]): OnboardingIntegrationPresentationStatus {
  switch (status) {
    case "connected":
    case "connected_limited":
    case "syncing":
      return "CONNECTED";
    case "installing":
      return "CONNECTING";
    case "error":
    case "auth_expired":
      return "FAILED";
    case "degraded":
    case "action_limited":
      return "CONNECTED";
    case "not_installed":
    case "disconnected":
    default:
      return "NOT_CONNECTED";
  }
}

export async function listOnboardingIntegrationCards(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ cards: OnboardingIntegrationCard[]; error: Error | null }> {
  const { data: accounts, error } = await getAccountsByOrg(supabase, orgId);
  if (error) return { cards: [], error };

  const byProvider = new Map<string, IntegrationAccountRow>();
  for (const a of accounts ?? []) {
    byProvider.set(a.provider, a);
  }

  const cards: OnboardingIntegrationCard[] = ONBOARDING_PROVIDER_KEYS.map((provider) => {
    const m = META[provider];
    const row = byProvider.get(provider);
    let status: OnboardingIntegrationPresentationStatus;
    if (!row) {
      status = m.connectMode === "assisted" ? "ASSISTED_SETUP" : "NOT_CONNECTED";
    } else {
      status = mapAccountStatus(row.status);
      if (m.connectMode === "assisted" && (status === "NOT_CONNECTED" || status === "FAILED")) {
        status = "ASSISTED_SETUP";
      }
    }
    return {
      provider,
      label: m.label,
      category: m.category,
      status,
      connectedAt: row?.installed_at ?? null,
      setupMinutes: m.setupMinutes,
      valueSummary: m.valueSummary,
      detectsSummary: m.detectsSummary,
    };
  });

  return { cards, error: null };
}

export function hasQualifyingCrmOrPaymentConnection(cards: OnboardingIntegrationCard[]): boolean {
  const crmOk = cards.some((c) => c.category === "crm" && c.status === "CONNECTED");
  const payOk = cards.some((c) => c.category === "payments" && c.status === "CONNECTED");
  return crmOk || payOk;
}
