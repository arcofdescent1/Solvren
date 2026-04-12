"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, CardTitle, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { phase3BasePayload } from "./phase3Analytics";

type Rec = {
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

export function ExpandCoverageStep(props: {
  orgId: string;
  phase3Status: string | null;
  currentStepKey: string | null;
  expandedCount: number;
  onRefresh: () => Promise<void>;
}) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const loadRecs = useCallback(async () => {
    const res = await fetch("/api/onboarding/phase3/recommendations");
    if (!res.ok) return;
    const j = (await res.json()) as { recommendations: Rec[] };
    setRecs(j.recommendations ?? []);
  }, []);

  useEffect(() => {
    void loadRecs();
  }, [loadRecs]);

  const onExpand = async (r: Rec) => {
    setMsg(null);
    trackAppEvent("onboarding_phase3_recommendation_clicked", {
      ...phase3BasePayload(props.orgId, props.phase3Status, props.currentStepKey),
      recommendationKind: r.kind,
      recommendationKey: r.key,
    });
    const res = await fetch("/api/onboarding/phase3/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: r.kind, key: r.key }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; alreadyCompleted?: boolean; mustConnect?: boolean; connectHref?: string; error?: string };
    if (!res.ok) {
      setMsg(j.error ?? "Request failed");
      return;
    }
    if (r.kind === "integration" && j.mustConnect && j.connectHref) {
      setMsg("Connect this integration to count toward expansion.");
      return;
    }
    setMsg(j.alreadyCompleted ? "Already connected or enabled." : "Saved.");
    await props.onRefresh();
  };

  return (
    <Stack gap={4}>
      <p className="text-sm text-[var(--text-muted)]">
        Goal: broaden footprint (CRM, ticketing, finance, Slack, ERP). Expansion counts new connected integrations plus newly enabled workflows vs your Phase 3 baseline (
        {props.expandedCount}/2 toward milestone).
      </p>
      {msg ? <p className="text-sm text-[var(--text-muted)]">{msg}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {recs.map((r) => (
          <Card key={`${r.kind}-${r.key}`}>
            <CardHeader>
              <CardTitle className="text-base">{r.providerName}</CardTitle>
              <p className="text-xs text-[var(--text-muted)]">
                {r.category} · ~{r.estimatedSetupMinutes} min
              </p>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <p>{r.expectedValue}</p>
              <p className="text-xs text-[var(--text-muted)]">{r.peerHint}</p>
              <div className="flex flex-wrap gap-2">
                {r.kind === "integration" ? (
                  <Button type="button" size="sm" onClick={() => void onExpand(r)}>
                    {r.ctaLabel}
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => void onExpand(r)}>
                    Enable in Solvren
                  </Button>
                )}
                <Button type="button" size="sm" variant="secondary" asChild>
                  <Link href={r.ctaHref}>Open setup</Link>
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </Stack>
  );
}
