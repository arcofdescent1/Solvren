"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, CardTitle, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { phase3BasePayload } from "./phase3Analytics";

type ProofJson = {
  status: string;
  story: {
    id: string;
    title: string;
    description: string;
    impact: { timeSavedHours?: number; estimatedRevenueProtected?: number };
    ctaUrl: string;
  } | null;
};

export function ProveValueStep(props: {
  orgId: string;
  phase3Status: string | null;
  currentStepKey: string | null;
}) {
  const [proof, setProof] = useState<ProofJson | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/onboarding/phase3/value-proof");
    if (!res.ok) return;
    const j = (await res.json()) as ProofJson;
    setProof(j);
    if (j.status === "READY" && j.story) {
      trackAppEvent("onboarding_phase3_value_story_seen", {
        ...phase3BasePayload(props.orgId, props.phase3Status, props.currentStepKey),
        storyId: j.story.id,
      });
    }
  }, [props.orgId, props.phase3Status, props.currentStepKey]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (!proof) return <p className="text-sm text-[var(--text-muted)]">Loading value proof…</p>;

  if (proof.status !== "READY" || !proof.story) {
    return (
      <Stack gap={2}>
        <p className="text-sm text-[var(--text-muted)]">
          No qualifying value story yet. Phase 3 can enter <strong>WAITING_FOR_VALUE_PROOF</strong> while you continue operating in
          Solvren — stories are generated from real outcomes, not onboarding placeholders.
        </p>
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link href="/outcomes/value-stories">Browse value stories</Link>
        </Button>
      </Stack>
    );
  }

  const s = proof.story;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{s.title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p>{s.description}</p>
        <ul className="list-inside list-disc text-[var(--text-muted)]">
          {s.impact.timeSavedHours != null ? <li>Time saved (hours): {s.impact.timeSavedHours}</li> : null}
          {s.impact.estimatedRevenueProtected != null ? (
            <li>Estimated revenue protected: ${Math.round(s.impact.estimatedRevenueProtected).toLocaleString()}</li>
          ) : null}
        </ul>
        <Button type="button" size="sm" asChild>
          <Link href={s.ctaUrl}>Open story</Link>
        </Button>
      </CardBody>
    </Card>
  );
}
