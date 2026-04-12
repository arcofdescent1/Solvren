"use client";

/**
 * Guided Phase 1 — multi-step setup wizard (guided state only; tracker stays authoritative).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody } from "@/ui/primitives/card";
import { Button } from "@/ui/primitives/button";
import { trackAppEvent } from "@/lib/appAnalytics";
import type { GuidedStepKey } from "@/modules/onboarding/domain/guided-phase1";
import { COMPANY_SIZES, INDUSTRIES, ONBOARDING_USE_CASE_KEYS, PRIMARY_GOALS } from "@/modules/onboarding/domain/guided-phase1";

type IntegrationCard = {
  provider: string;
  label: string;
  category: string;
  status: string;
  valueSummary: string;
  detectsSummary: string;
};

type StatePayload = {
  guided?: {
    effectiveStepKey?: string;
    status?: string | null;
    guidedPercentComplete?: number;
    companySize?: string | null;
    industry?: string | null;
    primaryGoal?: string | null;
    selectedUseCases?: string[];
    latestBaselineScanId?: string | null;
    firstInsightSummary?: {
      sourceMode?: string;
      issueCount?: number;
      estimatedRevenueAtRisk?: number;
      findings?: Record<string, { count?: number; estimatedImpact?: number }>;
    } | null;
  };
  guidedPercentComplete?: number;
  tracker?: { onboardingState?: string; activatedAt?: string | null };
  organization?: { id: string; name: string };
};

const USE_CASE_LABELS: Record<string, string> = {
  duplicate_contacts: "Duplicate contacts & messy CRM records",
  failed_payments: "Failed payments & involuntary churn risk",
  missing_lead_owners: "Missing owners on high-value leads",
  broken_handoffs: "Broken handoffs between teams",
  scheduling_failures: "Scheduling failures impacting revenue",
  broken_automation: "Broken automation in GTM systems",
  subscription_churn: "Subscription churn early warnings",
  crm_lifecycle_gaps: "CRM lifecycle coverage gaps",
};

export function GuidedOnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<StatePayload | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [biz, setBiz] = useState({ companySize: "", industry: "", primaryGoal: "" });
  const [useCases, setUseCases] = useState<string[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [ignoreServerScanId, setIgnoreServerScanId] = useState(false);
  const resultsViewTracked = useRef(false);

  const fetchState = useCallback(async () => {
    try {
      const qs = searchParams.toString();
      const res = await fetch(qs ? `/api/onboarding/state?${qs}` : "/api/onboarding/state");
      if (!res.ok) return;
      const d = (await res.json()) as StatePayload;
      setData(d);
      if (d.guided?.companySize) setBiz((b) => ({ ...b, companySize: d.guided!.companySize ?? b.companySize }));
      if (d.guided?.industry) setBiz((b) => ({ ...b, industry: d.guided!.industry ?? b.industry }));
      if (d.guided?.primaryGoal) setBiz((b) => ({ ...b, primaryGoal: d.guided!.primaryGoal ?? b.primaryGoal }));
      if (d.guided?.selectedUseCases?.length) setUseCases(d.guided.selectedUseCases);
    } catch {
      setData(null);
    }
  }, [searchParams]);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/integrations");
      if (!res.ok) return;
      const j = (await res.json()) as { integrations: IntegrationCard[] };
      setIntegrations(j.integrations ?? []);
    } catch {
      setIntegrations([]);
    }
  }, []);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  useEffect(() => {
    void fetchIntegrations();
  }, [fetchIntegrations]);

  const step = (data?.guided?.effectiveStepKey ?? "welcome") as GuidedStepKey;
  const guidedStatus = data?.guided?.status;

  useEffect(() => {
    const id = data?.guided?.latestBaselineScanId;
    if (id && !ignoreServerScanId) setScanId(id);
  }, [data?.guided?.latestBaselineScanId, ignoreServerScanId]);

  useEffect(() => {
    if (step === "results" && data?.guided?.firstInsightSummary && !resultsViewTracked.current) {
      resultsViewTracked.current = true;
      trackAppEvent("onboarding_first_results_viewed", { orgId: data.organization?.id });
    }
  }, [step, data?.guided?.firstInsightSummary, data?.organization?.id]);

  useEffect(() => {
    if (step === "integrations" || step === "baseline_scan") {
      void fetchIntegrations();
    }
  }, [step, fetchIntegrations]);

  useEffect(() => {
    if (step !== "baseline_scan" || !scanId) return;
    let cancelled = false;
    const tick = async () => {
      const res = await fetch(`/api/onboarding/baseline-scan/${scanId}`);
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as { status: string };
      setScanStatus(j.status);
      if (j.status === "COMPLETED" || j.status === "FAILED") {
        trackAppEvent("onboarding_baseline_scan_completed", { scanId, status: j.status });
        void fetchState();
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, scanId, fetchState]);

  const crmOrPaymentOk = useMemo(() => {
    const crm = integrations.some((c) => c.category === "crm" && c.status === "CONNECTED");
    const pay = integrations.some((c) => c.category === "payments" && c.status === "CONNECTED");
    return crm || pay;
  }, [integrations]);

  if (!data) {
    return <p className="text-sm text-[color:var(--rg-text-muted)]">Loading onboarding…</p>;
  }

  if (guidedStatus === "COMPLETED" || guidedStatus === "SKIPPED") {
    return (
      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-lg font-semibold text-[color:var(--rg-text)]">You&apos;re ready</h2>
          <p className="text-sm text-[color:var(--rg-text-muted)]">
            Guided setup is complete. Continue to your dashboard — you may still see activation prompts until live signals
            catch up.
          </p>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardBody>
      </Card>
    );
  }

  async function postJson(url: string, body?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      await fetchState();
      return j;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-4 rounded-lg border border-[color:var(--rg-border)] p-4 lg:sticky lg:top-24 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--rg-text-muted)]">Guided setup</p>
        <ul className="space-y-2 text-sm">
          {(
            [
              "welcome",
              "business_context",
              "integrations",
              "use_cases",
              "baseline_scan",
              "results",
            ] as const
          ).map((k) => (
            <li
              key={k}
              className={k === step ? "font-semibold text-[color:var(--rg-text)]" : "text-[color:var(--rg-text-muted)]"}
            >
              {k.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--rg-border)]">
          <div
            className="h-full bg-[color:var(--rg-primary)] transition-all"
            style={{
              width: `${data.guided?.guidedPercentComplete ?? data.guidedPercentComplete ?? 0}%`,
            }}
          />
        </div>
      </aside>

      <div className="space-y-6">
        {error && <p className="text-sm text-[color:var(--rg-danger)]">{error}</p>}

        {step === "welcome" && (
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-xl font-semibold text-[color:var(--rg-text)]">Welcome to Solvren</h2>
              <p className="text-sm text-[color:var(--rg-text-muted)]">
                Connect your systems, surface your biggest operational and revenue risks, and get to first value fast.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--rg-text)]">
                <li>Find what is breaking</li>
                <li>Quantify what it is costing</li>
                <li>Route the right action quickly</li>
              </ul>
              <Button
                disabled={loading}
                onClick={async () => {
                  trackAppEvent("onboarding_started", { orgId: data.organization?.id });
                  await postJson("/api/onboarding/guided/continue", { fromStep: "welcome" });
                }}
              >
                Set up my organization
              </Button>
            </CardBody>
          </Card>
        )}

        {step === "business_context" && (
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-xl font-semibold text-[color:var(--rg-text)]">Tell us about your business</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-[color:var(--rg-text-muted)]">Company size</span>
                  <select
                    className="w-full rounded border border-[color:var(--rg-border)] bg-transparent px-2 py-2 text-sm"
                    value={biz.companySize}
                    onChange={(e) => setBiz((b) => ({ ...b, companySize: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {COMPANY_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-[color:var(--rg-text-muted)]">Industry</span>
                  <select
                    className="w-full rounded border border-[color:var(--rg-border)] bg-transparent px-2 py-2 text-sm"
                    value={biz.industry}
                    onChange={(e) => setBiz((b) => ({ ...b, industry: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {INDUSTRIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-[color:var(--rg-text-muted)]">Primary goal</span>
                  <select
                    className="w-full rounded border border-[color:var(--rg-border)] bg-transparent px-2 py-2 text-sm"
                    value={biz.primaryGoal}
                    onChange={(e) => setBiz((b) => ({ ...b, primaryGoal: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {PRIMARY_GOALS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Button
                disabled={loading || !biz.companySize || !biz.industry || !biz.primaryGoal}
                onClick={async () => {
                  trackAppEvent("onboarding_business_context_saved", { orgId: data.organization?.id });
                  await postJson("/api/onboarding/business-context", {
                    companySize: biz.companySize,
                    industry: biz.industry,
                    primaryGoal: biz.primaryGoal,
                  });
                }}
              >
                Continue
              </Button>
            </CardBody>
          </Card>
        )}

        {step === "integrations" && (
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-xl font-semibold text-[color:var(--rg-text)]">Connect your systems</h2>
              <p className="text-sm text-[color:var(--rg-text-muted)]">
                Connect at least one CRM or payment system so Solvren can run a meaningful first scan.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {integrations.map((c) => (
                  <div key={c.provider} className="rounded-lg border border-[color:var(--rg-border)] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[color:var(--rg-text)]">{c.label}</p>
                        <p className="text-xs text-[color:var(--rg-text-muted)]">{c.category}</p>
                      </div>
                      <span className="rounded-full bg-[color:var(--rg-border)] px-2 py-0.5 text-xs">{c.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--rg-text-muted)]">{c.valueSummary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading || c.status === "CONNECTED"}
                        onClick={async () => {
                          trackAppEvent("onboarding_integration_connect_clicked", {
                            orgId: data.organization?.id,
                            provider: c.provider,
                          });
                          const res = await fetch(`/api/onboarding/integrations/${c.provider}/start`, {
                            method: "POST",
                          });
                          const j = (await res.json()) as Record<string, unknown>;
                          if (!res.ok) {
                            setError(String(j.error ?? "start_failed"));
                            return;
                          }
                          if (j.mode === "authorize_post" && j.startUrl) {
                            const r2 = await fetch(String(j.startUrl), {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(j.body ?? {}),
                            });
                            const j2 = (await r2.json()) as { authorizeUrl?: string; error?: string };
                            if (!r2.ok) {
                              setError(j2.error ?? "oauth_start_failed");
                              return;
                            }
                            if (j2.authorizeUrl) window.location.href = j2.authorizeUrl;
                          } else if (j.mode === "redirect_get" && j.redirectUrl) {
                            window.location.href = String(j.redirectUrl);
                          } else if (j.mode === "settings" && j.settingsPath) {
                            router.push(String(j.settingsPath));
                          }
                        }}
                      >
                        {c.status === "CONNECTED" ? "Connected" : "Connect"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                disabled={loading || !crmOrPaymentOk}
                onClick={async () => {
                  trackAppEvent("onboarding_integration_connected", { orgId: data.organization?.id });
                  await postJson("/api/onboarding/guided/continue", { fromStep: "integrations" });
                }}
              >
                Continue
              </Button>
              {!crmOrPaymentOk && (
                <p className="text-xs text-[color:var(--rg-text-muted)]">
                  Connect at least one CRM or payment system to continue.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {step === "use_cases" && (
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-xl font-semibold text-[color:var(--rg-text)]">Priority areas</h2>
              <p className="text-sm text-[color:var(--rg-text-muted)]">
                Select 1–3 priority areas to focus your first scan. You can choose up to 5 if needed.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ONBOARDING_USE_CASE_KEYS.map((k) => {
                  const on = useCases.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setUseCases((prev) => {
                          if (on) return prev.filter((x) => x !== k);
                          if (prev.length >= 5) return prev;
                          return [...prev, k];
                        });
                      }}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        on ? "border-[color:var(--rg-primary)] bg-[color:var(--rg-primary)]/10" : "border-[color:var(--rg-border)]"
                      }`}
                    >
                      <span className="font-medium text-[color:var(--rg-text)]">{USE_CASE_LABELS[k] ?? k}</span>
                    </button>
                  );
                })}
              </div>
              <Button
                disabled={loading || useCases.length < 1}
                onClick={async () => {
                  trackAppEvent("onboarding_use_cases_saved", { orgId: data.organization?.id, useCases });
                  await postJson("/api/onboarding/use-cases", { useCases });
                }}
              >
                Continue
              </Button>
            </CardBody>
          </Card>
        )}

        {step === "baseline_scan" && (
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-xl font-semibold text-[color:var(--rg-text)]">Baseline scan</h2>
              <p className="text-sm text-[color:var(--rg-text-muted)]">
                We&apos;ll read your connected systems and estimate where revenue or reliability is most at risk.
              </p>
              {!scanId && (
                <Button
                  disabled={loading}
                  onClick={async () => {
                    trackAppEvent("onboarding_baseline_scan_started", { orgId: data.organization?.id });
                    const j = (await postJson("/api/onboarding/baseline-scan")) as { scanId?: string };
                    if (j.scanId) {
                      setIgnoreServerScanId(false);
                      setScanId(j.scanId);
                    }
                  }}
                >
                  Start scan
                </Button>
              )}
              {scanId && (
                <ul className="space-y-2 text-sm text-[color:var(--rg-text-muted)]">
                  <li>Status: {scanStatus ?? "…"}</li>
                  <li>Connecting systems…</li>
                  <li>Detecting issues…</li>
                  {scanStatus === "FAILED" && (
                    <li className="text-[color:var(--rg-danger)]">
                      Scan failed.{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setIgnoreServerScanId(true);
                          setScanId(null);
                          setScanStatus(null);
                        }}
                      >
                        Retry
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </CardBody>
          </Card>
        )}

        {step === "results" && data.guided?.firstInsightSummary && (
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-xl font-semibold text-[color:var(--rg-text)]">First insights</h2>
              {data.guided.firstInsightSummary.sourceMode === "SIMULATED" && (
                <p className="rounded-md border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] px-3 py-2 text-xs text-[color:var(--rg-text-muted)]">
                  Preview estimate based on your selected systems and setup inputs.
                </p>
              )}
              <p className="text-3xl font-semibold text-[color:var(--rg-text)]">
                ${Number(data.guided.firstInsightSummary.estimatedRevenueAtRisk ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-[color:var(--rg-text-muted)]">Estimated revenue at risk (directional)</p>
              <p className="text-sm text-[color:var(--rg-text)]">
                Issues flagged: {data.guided.firstInsightSummary.issueCount ?? "—"}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.guided.firstInsightSummary.findings &&
                  Object.entries(data.guided.firstInsightSummary.findings).map(([k, v]) => (
                    <div key={k} className="rounded border border-[color:var(--rg-border)] p-3 text-sm">
                      <p className="font-medium text-[color:var(--rg-text)]">{USE_CASE_LABELS[k] ?? k}</p>
                      <p className="text-[color:var(--rg-text-muted)]">Count: {v.count ?? "—"}</p>
                      <p className="text-[color:var(--rg-text-muted)]">
                        Est. impact: ${Number(v.estimatedImpact ?? 0).toLocaleString()}
                      </p>
                    </div>
                  ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading}
                  onClick={async () => {
                    trackAppEvent("onboarding_first_value_acknowledged", { orgId: data.organization?.id });
                    await postJson("/api/onboarding/results/acknowledge");
                    trackAppEvent("onboarding_exited_to_dashboard", { orgId: data.organization?.id });
                    router.push("/dashboard");
                  }}
                >
                  Go to dashboard
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/integrations">Connect another system</Link>
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
