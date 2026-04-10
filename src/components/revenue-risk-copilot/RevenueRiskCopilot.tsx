"use client";

import * as React from "react";
import { Card, CardBody } from "@/ui";
import { cn } from "@/lib/cn";

export type CopilotProps = {
  activeOrgId: string | null;
  page?: string;
  dashboardState?: Record<string, number>;
  riskEvents?: Array<Record<string, unknown>>;
  changeRequests?: Array<{ id: string; title: string; status: string }>;
  className?: string;
};

export function RevenueRiskCopilot(props: CopilotProps) {
  const { activeOrgId, page = "dashboard", dashboardState, riskEvents = [], changeRequests = [], className } = props;
  const [data, setData] = React.useState<{ summary: string; recommended_actions: string[]; alerts: string[] } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!activeOrgId) {
      setLoading(false);
      setData({ summary: "Select an organization.", recommended_actions: [], alerts: [] });
      return;
    }
    let c = false;
    setLoading(true);
    fetch("/api/ai/copilot-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, dashboard_state: dashboardState, risk_events: riskEvents.slice(0, 5), change_requests: changeRequests.slice(0, 5) }),
    })
      .then((r) => r.json())
      .then((j) => { if (!c) setData(j); })
      .catch(() => { if (!c) setData({ summary: "Unable to load guidance.", recommended_actions: [], alerts: [] }); })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [activeOrgId, changeRequests, dashboardState, page, riskEvents]);

  if (!activeOrgId) return null;

  return (
    <aside className={cn("w-80 shrink-0 hidden xl:block", className)}>
      <Card className="sticky top-[calc(var(--topbar-height)+1rem)] border-[var(--primary)]/30 shadow-sm transition-shadow hover:shadow-md">
        <CardBody className="py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Revenue Risk Copilot</h3>
          {loading ? (
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-[var(--border)]" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--border)]" />
            </div>
          ) : data ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">{data.summary}</p>
              {data.alerts?.length ? <ul className="mt-3 space-y-1">{data.alerts.map((a, i) => <li key={i} className="text-xs font-medium text-[var(--danger)]">• {a}</li>)}</ul> : null}
              {data.recommended_actions?.length ? (
                <div className="mt-4">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Suggested actions:</p>
                  <ul className="mt-1 space-y-1">{data.recommended_actions.map((a, i) => <li key={i} className="text-sm text-[var(--text)]">• {a}</li>)}</ul>
                </div>
              ) : null}
            </>
          ) : null}
        </CardBody>
      </Card>
    </aside>
  );
}
