"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Clock3,
  FileText,
  ShieldCheck,
  Siren,
  TrendingDown,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Grid,
  PageActionBar,
  PageHeaderV2,
  SectionHeader,
  Stack,
} from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import type { RoiSummaryResponse } from "@/features/roi/types";
import { REVENUE_PROTECTION_PLAYBOOKS } from "@/lib/product/revenueProtectionPlaybooks";
import { PRODUCT_TERMS } from "@/config/productLanguage";

type RevenueSummary = {
  revenueAtRisk30d?: number;
  criticalPending?: Array<{ id: string; revenueSurface?: string | null }>;
  overdue?: Array<{ id: string }>;
  trend?: Array<{ day: string; revenueAtRisk?: number }>;
  topSurfaces?: Array<{ surface: string; revenueAtRisk: number }>;
};

type ImpactSummary = {
  totalRevenueAtRisk?: number;
  openIssueCount?: number;
  impactedIssueCount?: number;
  asOf?: string;
};

type ExecutiveSummary = {
  topDrivers?: Array<{ signalKey: string; count: number }>;
};

type BySystemResponse = {
  bySystem?: Array<{
    systemKey: string;
    issueCount: number;
    revenueAtRisk: number;
  }>;
};

type PendingTasksResponse = {
  tasks?: Array<{ id: string; status?: string }>;
};

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function driverBucket(label: string) {
  const value = label.toLowerCase();
  if (value.includes("billing")) return "Billing";
  if (value.includes("checkout")) return "Checkout";
  if (value.includes("renew")) return "Renewals";
  if (value.includes("price") || value.includes("promo")) return "Pricing";
  if (value.includes("entitle") || value.includes("access")) return "Access";
  if (value.includes("integrat")) return "Integrations";
  if (value.includes("approval") || value.includes("review")) return "Decision delays";
  return "Coverage gaps";
}

function coverageBucket(systemKey: string) {
  const value = systemKey.toLowerCase();
  if (value.includes("billing")) return "Billing";
  if (value.includes("checkout")) return "Checkout";
  if (value.includes("subscription") || value.includes("renew")) return "Renewals";
  if (value.includes("pricing") || value.includes("promo")) return "Pricing";
  if (value.includes("approval") || value.includes("review")) return "Decision delays";
  if (value.includes("integration")) return "Integrations";
  return "Coverage gaps";
}

function confidenceText(value?: string) {
  return (value ?? "estimated").replaceAll("_", " ");
}

function ProofMetric({
  label,
  value,
  helper,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof ShieldCheck;
  tone?: "primary" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-[var(--success)]/10 text-[var(--success)]"
      : tone === "warning"
        ? "bg-[var(--warning)]/15 text-[var(--warning)]"
        : "bg-[var(--primary)]/10 text-[var(--primary)]";

  return (
    <Card className="h-full shadow-sm">
      <CardBody>
        <Stack gap={3}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] ${toneClass}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{value}</p>
          </div>
          <p className="text-sm leading-6 text-[var(--text-muted)]">{helper}</p>
        </Stack>
      </CardBody>
    </Card>
  );
}

export default function InsightsLandingPage() {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") === "7d" ? "7d" : searchParams.get("range") === "90d" ? "90d" : "30d";

  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [executive, setExecutive] = useState<ExecutiveSummary | null>(null);
  const [bySystem, setBySystem] = useState<BySystemResponse | null>(null);
  const [pendingTasks, setPendingTasks] = useState<PendingTasksResponse | null>(null);
  const [roi, setRoi] = useState<RoiSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [revRes, impactRes, execRes, systemRes, tasksRes, roiRes] = await Promise.all([
          fetch("/api/executive/revenue-summary"),
          fetch("/api/reporting/impact/executive-summary"),
          fetch(`/api/executive/summary?range=${range}`),
          fetch("/api/reporting/impact/by-system"),
          fetch("/api/execution/pending-tasks?limit=100"),
          fetch(`/api/insights/roi-summary?range=${range}`),
        ]);

        const rev = (await revRes.json().catch(() => ({}))) as RevenueSummary;
        const imp = (await impactRes.json().catch(() => ({}))) as ImpactSummary;
        const exec = (await execRes.json().catch(() => ({}))) as ExecutiveSummary;
        const systems = (await systemRes.json().catch(() => ({}))) as BySystemResponse;
        const tasks = (await tasksRes.json().catch(() => ({}))) as PendingTasksResponse;
        const roiSummary = (await roiRes.json().catch(() => null)) as RoiSummaryResponse | null;

        if (mounted) {
          setRevenue(rev);
          setImpact(imp);
          setExecutive(exec);
          setBySystem(systems);
          setPendingTasks(tasks);
          setRoi(roiSummary);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [range]);

  useEffect(() => {
    trackAppEvent("proof_page_view", { page: "proof", range });
  }, [range]);

  const issueExposure = Math.max(0, toNumber(impact?.totalRevenueAtRisk));
  const changeExposure = Math.max(0, toNumber(revenue?.revenueAtRisk30d));
  const systemGapExposure = Math.max(
    0,
    (bySystem?.bySystem ?? [])
      .filter((system) => system.systemKey === "unknown")
      .reduce((acc, system) => acc + toNumber(system.revenueAtRisk), 0)
  );
  const exposure = issueExposure + changeExposure + systemGapExposure;
  const roiData = roi && roi.ok ? roi : null;

  const trend = revenue?.trend ?? [];
  const trendSlice = range === "7d" ? trend.slice(-7) : range === "90d" ? trend.slice(-90) : trend.slice(-30);
  const prev = trendSlice.length > 1 ? toNumber(trendSlice[0]?.revenueAtRisk) : 0;
  const latest = trendSlice.length > 0 ? toNumber(trendSlice[trendSlice.length - 1]?.revenueAtRisk) : 0;
  const changePct = prev > 0 ? ((latest - prev) / prev) * 100 : 0;
  const trendLabel = changePct < -5 ? "Risk is decreasing" : changePct > 5 ? "Risk is increasing" : "Risk is stable";

  const protectedRevenue = roiData?.metrics.prevented.displayValue ?? formatMoney(Math.max(0, exposure - latest));
  const risksPrevented = roiData?.metrics.prevented.displayValue ?? "0";
  const decisionsAccelerated = roiData?.metrics.governed.displayValue ?? `${(revenue?.criticalPending ?? []).length}`;
  const incidentsAvoided = roiData?.metrics.resolved.displayValue ?? `${Math.max(0, toNumber(impact?.impactedIssueCount))}`;
  const pendingExecution = (pendingTasks?.tasks ?? []).length;

  const driverRows = useMemo(() => {
    const contribution = new Map<string, number>();

    for (const surface of revenue?.topSurfaces ?? []) {
      const label = driverBucket(surface.surface);
      contribution.set(label, (contribution.get(label) ?? 0) + toNumber(surface.revenueAtRisk));
    }

    for (const system of bySystem?.bySystem ?? []) {
      const label = coverageBucket(system.systemKey);
      contribution.set(label, (contribution.get(label) ?? 0) + toNumber(system.revenueAtRisk));
    }

    const countByBucket = new Map<string, number>();
    for (const driver of executive?.topDrivers ?? []) {
      const label = driverBucket(driver.signalKey);
      countByBucket.set(label, (countByBucket.get(label) ?? 0) + toNumber(driver.count));
    }

    return Array.from(contribution.entries())
      .map(([label, value]) => ({
        label,
        contribution: Math.max(0, Math.round(value)),
        status: (countByBucket.get(label) ?? 0) >= 2 ? "Needs attention" : "Stable",
        href:
          label === "Decision delays"
            ? "/settings/policies"
            : label === "Integrations" || label === "Coverage gaps"
              ? "/integrations"
              : label === "Checkout" || label === "Billing" || label === "Pricing"
                ? "/changes?view=all&impact=high"
                : "/issues?severity=high",
      }))
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 6);
  }, [revenue, bySystem, executive]);

  const coveredSystems = Math.max(
    0,
    (bySystem?.bySystem ?? []).filter((system) => system.systemKey !== "unknown" && system.issueCount > 0).length
  );
  const uncoveredSystems = Math.max(0, (bySystem?.bySystem ?? []).filter((system) => system.systemKey === "unknown").length);

  return (
    <Stack gap={8}>
      <PageHeaderV2
        breadcrumbs={[{ label: PRODUCT_TERMS.proof.title }]}
        title={PRODUCT_TERMS.proof.title}
        description="Board-ready proof of the revenue Solvren protected, the risks it prevented, and the decisions it helped move faster."
        helper="Use this page to answer: what value did Solvren protect, where did it help, and where should leaders act next?"
      />

      <PageActionBar
        ariaLabel="Proof sections"
        items={[
          { label: "Value", href: "#value" },
          { label: "Stories", href: "#stories" },
          { label: "Packets", href: "#packets" },
          { label: "Drivers", href: "#drivers" },
          { label: "Coverage", href: "#coverage" },
        ]}
        actions={
          <>
            <Button asChild size="md">
              <Link href="/insights/roi">
                Open full proof view
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="md">
              <Link href="/outcomes/value-stories">Value stories</Link>
            </Button>
          </>
        }
      />

      <section id="value" className="scroll-mt-28 rounded-[var(--radius-xl)] border border-[var(--primary)]/20 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_8%,var(--bg-surface)),var(--bg-surface)_52%,color-mix(in_oklab,var(--success)_7%,var(--bg-surface)))] p-5 shadow-sm sm:p-7">
        <Stack gap={6}>
          <div className="max-w-4xl">
            <Badge variant="outline">{loading ? "Building proof" : `Updated ${impact?.asOf ? new Date(impact.asOf).toLocaleDateString() : "today"}`}</Badge>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-[var(--text)]">
              Solvren turns risk work into a credible value story.
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-muted)]">
              Leaders get the answer without decoding logs: what was at risk, what action happened, what value was protected, and what proof backs it up.
            </p>
          </div>

          <Grid cols={1} gap={3} className="md:grid-cols-2 xl:grid-cols-4">
            <ProofMetric
              icon={Banknote}
              tone="success"
              label="Revenue protected"
              value={protectedRevenue}
              helper={roiData?.metrics.prevented.valueStatement ?? "Estimated protected value based on prevented or resolved exposure."}
            />
            <ProofMetric
              icon={ShieldCheck}
              label="Risks prevented"
              value={risksPrevented}
              helper={confidenceText(roiData?.metrics.prevented.confidence)}
            />
            <ProofMetric
              icon={Clock3}
              tone="warning"
              label="Decisions accelerated"
              value={decisionsAccelerated}
              helper={roiData?.metrics.governed.valueStatement ?? "High-impact decisions reviewed before drift becomes loss."}
            />
            <ProofMetric
              icon={Siren}
              label="Incidents avoided"
              value={incidentsAvoided}
              helper={roiData?.metrics.resolved.valueStatement ?? "Issues resolved or prevented before business impact expanded."}
            />
          </Grid>

          <Stack direction="row" gap={2} className="flex-wrap">
            <Button asChild>
              <Link href="/insights/roi">
                Review proof details
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/outcomes/value-stories">Open value stories</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/changes?view=all">Find decision packets</Link>
            </Button>
          </Stack>
        </Stack>
      </section>

      <Grid cols={1} gap={4} className="xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="shadow-sm">
          <CardBody>
            <SectionHeader
              title="Current risk picture"
              helper="The exposure Solvren is still watching, so leaders know what remains at stake."
              action={
                <div className="flex gap-2 text-sm">
                  {(["7d", "30d", "90d"] as const).map((value) => (
                    <Link
                      key={value}
                      href={`/insights?range=${value}`}
                      className={range === value ? "font-semibold text-[var(--primary)]" : "text-[var(--text-muted)]"}
                    >
                      {value}
                    </Link>
                  ))}
                </div>
              }
            />
            {loading ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Loading proof data...</p>
            ) : exposure <= 0 ? (
              <EmptyState
                variant="still_building"
                title="Proof data is still building"
                body="As Solvren watches more systems and decisions, this area will show protected value and remaining exposure."
              />
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Remaining exposure</p>
                  <p className="mt-1 text-3xl font-semibold">{formatMoney(exposure)}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{trendLabel} over the selected window.</p>
                </div>
                <div className="space-y-2">
                  {[
                    ["Problems", issueExposure],
                    ["Decisions", changeExposure],
                    ["Coverage gaps", systemGapExposure],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-28 text-xs text-[var(--text-muted)]">{label}</div>
                      <div className="h-2 flex-1 rounded-full bg-[var(--bg-surface-2)]">
                        <div
                          className="h-2 rounded-full bg-[var(--primary)]"
                          style={{ width: `${Math.max(4, Math.round((Number(value) / (exposure || 1)) * 100))}%` }}
                        />
                      </div>
                      <div className="w-28 text-right text-xs font-semibold">{formatMoney(Number(value))}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="shadow-sm">
          <CardBody>
            <SectionHeader title="Proof trend" helper="Directional proof without over-claiming precision." />
            <div className="mt-4 space-y-2">
              {trendSlice.length === 0 ? (
                <EmptyState
                  variant="still_building"
                  title="Trend is building"
                  body="Trend data appears once Solvren has enough observations."
                />
              ) : (
                trendSlice.slice(-12).map((row) => (
                  <div key={row.day} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-[var(--text-muted)]">{row.day}</div>
                    <div className="h-2 flex-1 rounded-full bg-[var(--bg-surface-2)]">
                      <div
                        className="h-2 rounded-full bg-[var(--success)]"
                        style={{ width: `${Math.max(4, Math.round((toNumber(row.revenueAtRisk) / (latest || 1)) * 100))}%` }}
                      />
                    </div>
                    <div className="w-28 text-right text-xs font-semibold">{formatMoney(toNumber(row.revenueAtRisk))}</div>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </Grid>

      <section id="stories" className="scroll-mt-28 space-y-3">
        <SectionHeader
          title="Value stories"
          helper="Concrete examples leaders can use in QBRs, board prep, and operating reviews."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/outcomes/value-stories">View all stories</Link>
            </Button>
          }
        />
        <Grid cols={1} gap={3} className="md:grid-cols-3">
          {REVENUE_PROTECTION_PLAYBOOKS.slice(0, 3).map((playbook) => (
            <Link
              key={playbook.title}
              href={playbook.href}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm transition hover:border-[var(--primary)]/40 hover:shadow-md"
            >
              <p className="font-semibold text-[var(--text)]">{playbook.title}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{playbook.buyer}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{playbook.outcome}</p>
            </Link>
          ))}
        </Grid>
      </section>

      <section id="packets" className="scroll-mt-28">
        <Card className="shadow-sm">
          <CardBody>
            <Stack direction="row" justify="between" gap={4} className="flex-wrap">
              <div className="max-w-2xl">
                <SectionHeader
                  title="Board-ready proof packets"
                  helper="Exportable decision and value records that make Solvren credible outside the product."
                />
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Proof packets combine business context, decision status, evidence, approvals, delivery history, and outcomes so a CEO or board member can review the story without opening the operational workflow.
                </p>
              </div>
              <div className="grid min-w-[18rem] gap-2">
                <Button asChild>
                  <Link href="/changes?view=all">
                    Decision proof packets
                    <FileText className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/outcomes">Executive outcomes</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/insights/roi">ROI proof view</Link>
                </Button>
              </div>
            </Stack>
          </CardBody>
        </Card>
      </section>

      <section id="drivers" className="scroll-mt-28 space-y-3">
        <SectionHeader title="Where value is created" helper="The workstreams most responsible for protected value and remaining exposure." />
        <Grid cols={1} gap={3} className="md:grid-cols-2 xl:grid-cols-3">
          {driverRows.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  variant="still_building"
                  title="Drivers are building"
                  body="Solvren will show value drivers once enough protected-value signals exist."
                />
              </CardBody>
            </Card>
          ) : (
            driverRows.map((driver) => (
              <Link
                key={driver.label + driver.href}
                href={driver.href}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm transition hover:border-[var(--primary)]/40 hover:shadow-md"
              >
                <Stack direction="row" justify="between" align="start" gap={3}>
                  <div>
                    <p className="font-semibold text-[var(--text)]">{driver.label}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{formatMoney(driver.contribution)} at stake</p>
                  </div>
                  <Badge variant={driver.status === "Needs attention" ? "warning" : "secondary"}>{driver.status}</Badge>
                </Stack>
              </Link>
            ))
          )}
        </Grid>
      </section>

      <section id="coverage" className="scroll-mt-28">
        <Grid cols={1} gap={4} className="lg:grid-cols-3">
          <Card className="shadow-sm">
            <CardBody>
              <ProofMetric
                icon={BadgeCheck}
                tone="success"
                label="Coverage active"
                value={`${coveredSystems}`}
                helper="Connected areas producing useful proof signals."
              />
            </CardBody>
          </Card>
          <Card className="shadow-sm">
            <CardBody>
              <ProofMetric
                icon={TrendingDown}
                label="Work in motion"
                value={`${pendingExecution}`}
                helper="Open follow-up tasks tied to active revenue protection."
              />
            </CardBody>
          </Card>
          <Card className="shadow-sm">
            <CardBody>
              <ProofMetric
                icon={FileText}
                tone="warning"
                label="Coverage gaps"
                value={`${uncoveredSystems}`}
                helper="Areas where connecting more systems would make the proof stronger."
              />
            </CardBody>
          </Card>
        </Grid>
      </section>
    </Stack>
  );
}
