"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardBody, Stack, Button } from "@/ui";

type Step =
  | "NOT_STARTED"
  | "REVIEW_PRIVACY_MODE"
  | "CONNECT_INTEGRATION"
  | "ANALYZING"
  | "FIRST_INSIGHTS"
  | "FIRST_ACTION"
  | "FIRST_RESOLUTION"
  | "COMPLETE";

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

export function Phase5OnboardingWizard() {
  const [step, setStep] = useState<Step | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    connectedCount: number;
    topIssues: Array<{ id: string; title: string; revenue_impact_cents: number }>;
    projectedRevenueAtRiskCents: number;
    initialDetectionTriggered?: boolean;
  } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);
  const analyzeTriggerSent = useRef(false);
  const [analyzingSlow, setAnalyzingSlow] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/onboarding/state");
    const j = (await res.json()) as {
      ok?: boolean;
      orgId?: string;
      step?: Step;
      error?: string;
      connectedCount?: number;
      topIssues?: Array<{ id: string; title: string; revenue_impact_cents: number }>;
      projectedRevenueAtRiskCents?: number;
      initialDetectionTriggered?: boolean;
    };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Failed to load onboarding");
      setLoading(false);
      return;
    }
    setOrgId(j.orgId ?? null);
    setStep(j.step ?? null);
    setPayload({
      connectedCount: j.connectedCount ?? 0,
      topIssues: j.topIssues ?? [],
      projectedRevenueAtRiskCents: j.projectedRevenueAtRiskCents ?? 0,
      initialDetectionTriggered: j.initialDetectionTriggered,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (step !== "ANALYZING") {
      startTransition(() => setAnalyzingSlow(false));
      return;
    }
    startTransition(() => setAnalyzingSlow(false));
    pollStart.current = Date.now();
    const slowTimer = window.setTimeout(() => {
      startTransition(() => setAnalyzingSlow(true));
    }, 60_000);
    pollRef.current = setInterval(() => {
      if (Date.now() - pollStart.current > 60_000) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      void load();
    }, 3000);
    return () => {
      window.clearTimeout(slowTimer);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, load]);

  useEffect(() => {
    if (step !== "ANALYZING") return;
    if (payload?.initialDetectionTriggered) return;
    if (analyzeTriggerSent.current) return;
    analyzeTriggerSent.current = true;
    void (async () => {
      await fetch("/api/onboarding/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger_detection" }),
      });
      await load();
    })();
  }, [step, payload?.initialDetectionTriggered, load]);

  const choosePrivacyAndContinue = async (privacyMode: "minimal" | "expanded") => {
    if (!orgId) {
      setError("Missing organization");
      return;
    }
    setError(null);
    const pr = await fetch("/api/org/security/privacy-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, privacyMode }),
    });
    if (!pr.ok) {
      const j = (await pr.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Could not save privacy mode");
      return;
    }
    const done = await fetch("/api/onboarding/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete_privacy_review" }),
    });
    if (!done.ok) {
      const j = (await done.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Could not continue onboarding");
      return;
    }
    await load();
  };

  const advanceInsights = async () => {
    await fetch("/api/onboarding/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance_insights" }),
    });
    await load();
  };

  if (loading || !step) {
    return <p className="text-sm text-[var(--text-muted)]">Loading onboarding…</p>;
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (step === "COMPLETE") {
    return (
      <Card>
        <CardBody>
          <p className="font-semibold">You&apos;re set up.</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Solvren is now monitoring your business. Verified ROI appears after issues resolve and the verification window
            completes.
          </p>
          <Link href="/dashboard">
            <Button className="mt-4">Go to action queue</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Stack gap={4}>
      {step === "REVIEW_PRIVACY_MODE" && (
        <Card>
          <CardBody>
            <p className="font-semibold">Choose your data protection mode</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              <strong>Minimal Data Mode</strong> is recommended: operational signals, failure rates, and estimates without raw
              revenue payloads. <strong>Expanded Insights Mode</strong> optionally adds limited derived financial bands.
              Automation &quot;safe mode&quot; is separate—see settings after setup.
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Write-back to external systems stays off until you enable it in{" "}
              <Link href="/settings/security" className="font-semibold text-[var(--primary)] hover:underline">
                Security settings
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="default" onClick={() => void choosePrivacyAndContinue("minimal")}>
                Continue with Minimal Data Mode
              </Button>
              <Button variant="secondary" onClick={() => void choosePrivacyAndContinue("expanded")}>
                Use Expanded Insights Mode
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === "CONNECT_INTEGRATION" && (
        <Card>
          <CardBody>
            <p className="font-semibold">Connect your system</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Connect Stripe, HubSpot, or Salesforce to find hidden revenue risks. One connection is enough.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/org/settings/integrations/stripe">
                <Button variant="default">Connect Stripe</Button>
              </Link>
              <Link href="/org/settings/integrations/hubspot">
                <Button variant="secondary">Connect HubSpot</Button>
              </Link>
              <Link href="/org/settings/integrations/salesforce">
                <Button variant="secondary">Connect Salesforce</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {step === "ANALYZING" && (
        <Card>
          <CardBody>
            <p className="font-semibold">Analyzing your data…</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {analyzingSlow
                ? "Still analyzing your data…"
                : "This usually takes a moment. Checking every few seconds."}
            </p>
          </CardBody>
        </Card>
      )}

      {step === "FIRST_INSIGHTS" && payload && (
        <Card>
          <CardBody>
            <p className="font-semibold">First insights</p>
            <p className="mt-2 text-lg">
              We found {(payload.topIssues ?? []).length || "—"} issue
              {(payload.topIssues ?? []).length === 1 ? "" : "s"} affecting{" "}
              <strong>{fmtMoney(payload.projectedRevenueAtRiskCents)}</strong>{" "}
              <span className="text-sm text-[var(--text-muted)]">(projected impact)</span>
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {(payload.topIssues ?? []).slice(0, 3).map((i) => (
                <li key={i.id}>
                  {i.title} — {fmtMoney(i.revenue_impact_cents)}
                </li>
              ))}
            </ul>
            <Button className="mt-4" variant="default" onClick={() => void advanceInsights()}>
              Continue — take your first action
            </Button>
          </CardBody>
        </Card>
      )}

      {(step === "FIRST_ACTION" || step === "FIRST_RESOLUTION") && (
        <Card>
          <CardBody>
            <p className="font-semibold">{step === "FIRST_ACTION" ? "Take your first action" : "Complete your first fix"}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {step === "FIRST_ACTION"
                ? "Acknowledge, assign, or approve an issue from the queue."
                : "Mark an issue as resolved when you’ve addressed it."}
            </p>
            <Link href="/action-queue">
              <Button className="mt-4" variant="default">
                Open action queue
              </Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </Stack>
  );
}
