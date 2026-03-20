"use client";

import { useState, useEffect } from "react";
import { Card, CardBody } from "@/ui";

const FALLBACK_EXPLANATION = "Solvren detected this risk event. Review the details and link to a change request if needed.";

export type RiskExplanationPanelProps = {
  riskEventId: string;
};

export function RiskExplanationPanel({ riskEventId }: RiskExplanationPanelProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(false);
      }
    });
    fetch("/api/ai/risk-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ risk_event_id: riskEventId }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if ((json as { ok?: boolean }).ok && (json as { explanation?: string }).explanation) {
          setExplanation((json as { explanation: string }).explanation);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [riskEventId]);

  return (
    <Card className="border-[var(--primary)]/20 bg-[var(--bg-surface)]">
      <CardBody className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">Plain-language explanation</h3>
        {loading && (
          <p className="text-sm text-[var(--text-muted)]">Generating explanation…</p>
        )}
        {!loading && explanation && (
          <p className="text-sm text-[var(--text)]">{explanation}</p>
        )}
        {!loading && error && (
          <p className="text-sm text-[var(--text-muted)]">{FALLBACK_EXPLANATION}</p>
        )}
      </CardBody>
    </Card>
  );
}
