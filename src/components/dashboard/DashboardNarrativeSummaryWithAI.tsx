"use client";

import { useEffect, useState } from "react";
import { DashboardNarrativeSummary } from "./DashboardNarrativeSummary";

const COPILOT_TIMEOUT_MS = 2000;

type DashboardState = {
  total_exposure?: number;
  high_risk_count?: number;
  unapproved_count?: number;
  compliance_pct?: number;
};

type RiskEvent = {
  id: string;
  provider?: string;
  object?: string;
  risk_type?: string;
  impact_amount?: number | null;
  approved_at?: string | null;
  change_event_id?: string | null;
};

type FallbackNarrative = {
  headline: string | null;
  summary: string;
  suggestedAction: string | null;
  topEventId: string | null;
};

type Props = {
  fallback: FallbackNarrative;
  dashboardState?: DashboardState;
  riskEvents?: RiskEvent[];
  changeRequests?: Array<{ id: string; title: string; status: string }>;
};

export function DashboardNarrativeSummaryWithAI({
  fallback,
  dashboardState,
  riskEvents = [],
  changeRequests = [],
}: Props) {
  const [narrative, setNarrative] = useState<FallbackNarrative>(fallback);

  useEffect(() => {
    const hasContext = (dashboardState && Object.keys(dashboardState).length > 0) || riskEvents.length > 0;
    if (!hasContext) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), COPILOT_TIMEOUT_MS);

    fetch("/api/ai/copilot-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        page: "dashboard",
        dashboard_state: dashboardState ?? {},
        risk_events: riskEvents.slice(0, 5),
        change_requests: changeRequests.slice(0, 5),
      }),
    })
      .then((r) => r.json())
      .then((j: { summary?: string; recommended_actions?: string[] }) => {
        const summary = typeof j.summary === "string" && j.summary.trim() ? j.summary.trim() : fallback.summary;
        const suggestedAction =
          Array.isArray(j.recommended_actions) && j.recommended_actions.length > 0
            ? j.recommended_actions[0]
            : fallback.suggestedAction;
        setNarrative({
          headline: fallback.headline,
          summary,
          suggestedAction,
          topEventId: fallback.topEventId,
        });
      })
      .catch(() => {
        // Keep fallback on error or timeout
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [dashboardState, riskEvents.length, changeRequests.length, fallback.headline, fallback.summary, fallback.suggestedAction, fallback.topEventId]);

  return (
    <DashboardNarrativeSummary
      headline={narrative.headline}
      summary={narrative.summary}
      suggestedAction={narrative.suggestedAction}
      topEventId={narrative.topEventId}
    />
  );
}
