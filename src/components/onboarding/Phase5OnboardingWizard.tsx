"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, Grid, Stack } from "@/ui";

type Step =
  | "NOT_STARTED"
  | "REVIEW_PRIVACY_MODE"
  | "CONNECT_INTEGRATION"
  | "ANALYZING"
  | "FIRST_INSIGHTS"
  | "FIRST_ACTION"
  | "FIRST_RESOLUTION"
  | "COMPLETE";

type SetupPayload = {
  connectedCount: number;
  topIssues: Array<{ id: string; title: string; revenue_impact_cents: number }>;
  projectedRevenueAtRiskCents: number;
  initialDetectionTriggered?: boolean;
  license?: {
    tier: string;
    protectedRevenueBand: string;
    implementationMode: string;
    unlimitedExecutiveAccess: boolean;
    licensedBusinessUnits: number | null;
    licensedIntegrations: string[] | null;
    licensedDomains: string[] | null;
    premiumModules: string[];
    capabilities: Record<string, boolean>;
  };
};

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function stepIndex(step: Step) {
  if (step === "REVIEW_PRIVACY_MODE" || step === "NOT_STARTED") return 1;
  if (step === "CONNECT_INTEGRATION") return 2;
  if (step === "ANALYZING" || step === "FIRST_INSIGHTS") return 3;
  return 4;
}

export function Phase5OnboardingWizard() {
  const [step, setStep] = useState<Step | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [payload, setPayload] = useState<SetupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingSlow, setCheckingSlow] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);
  const analyzeTriggerSent = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/onboarding/state");
    const json = (await res.json()) as {
      ok?: boolean;
      orgId?: string;
      step?: Step;
      error?: string;
      connectedCount?: number;
      topIssues?: Array<{ id: string; title: string; revenue_impact_cents: number }>;
      projectedRevenueAtRiskCents?: number;
      initialDetectionTriggered?: boolean;
      license?: SetupPayload["license"];
    };
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Failed to load setup");
      setLoading(false);
      return;
    }
    setOrgId(json.orgId ?? null);
    setStep(json.step ?? null);
    setPayload({
      connectedCount: json.connectedCount ?? 0,
      topIssues: json.topIssues ?? [],
      projectedRevenueAtRiskCents: json.projectedRevenueAtRiskCents ?? 0,
      initialDetectionTriggered: json.initialDetectionTriggered,
      license: json.license,
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
      startTransition(() => setCheckingSlow(false));
      return;
    }
    pollStart.current = Date.now();
    const slowTimer = window.setTimeout(() => {
      startTransition(() => setCheckingSlow(true));
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
    const privacyRes = await fetch("/api/org/security/privacy-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, privacyMode }),
    });
    if (!privacyRes.ok) {
      const json = (await privacyRes.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Could not save data protection mode");
      return;
    }
    const done = await fetch("/api/onboarding/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete_privacy_review" }),
    });
    if (!done.ok) {
      const json = (await done.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Could not continue setup");
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
    return <p className="text-sm text-[var(--text-muted)]">Loading setup...</p>;
  }

  if (error) {
    return <p className="text-sm text-[var(--danger)]">{error}</p>;
  }

  if (step === "COMPLETE") {
    return (
      <Card>
        <CardBody>
          <p className="font-semibold">Revenue protection is on.</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Solvren is watching your connected systems. Proof appears as decisions move, problems resolve, and value stories become credible.
          </p>
          <Button asChild className="mt-4">
            <Link href="/home">Go to Home</Link>
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Stack gap={4}>
      <Card className="border-[var(--primary)]/20 shadow-sm">
        <CardBody>
          <Stack direction="row" justify="between" align="center" gap={4} className="flex-wrap">
            <div>
              <Badge variant="outline">Step {stepIndex(step)} of 4</Badge>
              <p className="mt-3 font-semibold">Turn on revenue protection</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Connect systems, protect the right workflows, invite decision makers, and review the first value signal.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/integrations">Open full Setup</Link>
            </Button>
          </Stack>
        </CardBody>
      </Card>

      {payload?.license && (payload.license.tier === "ENTERPRISE" || payload.license.tier === "STRATEGIC_ENTERPRISE") ? (
        <Card>
          <CardBody>
            <p className="font-semibold">
              {payload.license.implementationMode === "WHITE_GLOVE" ? "White-glove rollout" : "Guided rollout"}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Your agreement covers {payload.license.protectedRevenueBand.replaceAll("_", " ")} protected revenue. Start with the systems in scope, the decision makers who approve risk, and one proof story.
            </p>
            <Grid cols={1} gap={2} className="mt-3 md:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
                <p className="font-semibold">Protect</p>
                <p className="mt-1 text-[var(--text-muted)]">
                  {payload.license.licensedBusinessUnits ?? "All licensed"} business units, {(payload.license.licensedDomains ?? ["REVENUE"]).join(", ")} areas.
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
                <p className="font-semibold">Connect</p>
                <p className="mt-1 text-[var(--text-muted)]">
                  {(payload.license.licensedIntegrations ?? ["Stripe", "Salesforce", "HubSpot"]).join(", ")}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
                <p className="font-semibold">Prove</p>
                <p className="mt-1 text-[var(--text-muted)]">
                  {payload.license.capabilities.board_ready_exports ? "Board-ready proof packets are enabled." : "Proof packets show value quickly."}
                </p>
              </div>
            </Grid>
          </CardBody>
        </Card>
      ) : null}

      {step === "REVIEW_PRIVACY_MODE" ? (
        <Card>
          <CardBody>
            <p className="font-semibold">Choose your data protection mode</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Minimal Data Mode is recommended. Solvren uses operational signals, failure rates, and estimates without raw revenue payloads. Expanded Insights Mode can add limited derived financial bands.
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Write-back to external systems stays off until you enable it in{" "}
              <Link href="/settings/security" className="font-semibold text-[var(--primary)] hover:underline">
                Security settings
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void choosePrivacyAndContinue("minimal")}>Continue with Minimal Data Mode</Button>
              <Button variant="secondary" onClick={() => void choosePrivacyAndContinue("expanded")}>
                Use Expanded Insights Mode
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === "CONNECT_INTEGRATION" ? (
        <Card>
          <CardBody>
            <p className="font-semibold">Connect your first system</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Connect Stripe, HubSpot, or Salesforce to start finding hidden revenue risk. One healthy connection is enough to begin.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/org/settings/integrations/stripe">Connect Stripe</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/org/settings/integrations/hubspot">Connect HubSpot</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/org/settings/integrations/salesforce">Connect Salesforce</Link>
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === "ANALYZING" ? (
        <Card>
          <CardBody>
            <p className="font-semibold">Looking for your first revenue-risk signal...</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {checkingSlow ? "Still checking your connected system..." : "This usually takes a moment. Solvren is looking for the first useful signal."}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {step === "FIRST_INSIGHTS" && payload ? (
        <Card>
          <CardBody>
            <p className="font-semibold">First risk found</p>
            <p className="mt-2 text-lg">
              Solvren found {(payload.topIssues ?? []).length || "-"} problem
              {(payload.topIssues ?? []).length === 1 ? "" : "s"} affecting{" "}
              <strong>{fmtMoney(payload.projectedRevenueAtRiskCents)}</strong>{" "}
              <span className="text-sm text-[var(--text-muted)]">(estimated money at risk)</span>
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {(payload.topIssues ?? []).slice(0, 3).map((issue) => (
                <li key={issue.id}>
                  {issue.title} - {fmtMoney(issue.revenue_impact_cents)}
                </li>
              ))}
            </ul>
            <Button className="mt-4" onClick={() => void advanceInsights()}>
              Continue to your first action
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {step === "FIRST_ACTION" || step === "FIRST_RESOLUTION" ? (
        <Card>
          <CardBody>
            <p className="font-semibold">{step === "FIRST_ACTION" ? "Take your first action" : "Complete your first fix"}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {step === "FIRST_ACTION"
                ? "Acknowledge, assign, or approve the first item that needs attention."
                : "Mark the problem as resolved once the fix is complete."}
            </p>
            <Button asChild className="mt-4">
              <Link href="/actions">Open Decisions</Link>
            </Button>
          </CardBody>
        </Card>
      ) : null}
    </Stack>
  );
}
