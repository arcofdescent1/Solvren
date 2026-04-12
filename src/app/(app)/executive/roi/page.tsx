"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardBody, EmptyState, Grid, PageHeaderV2, SectionHeader, Stack } from "@/ui";
import { MetricHelpTooltip, PageHelpDrawer } from "@/components/help";
import { trackAppEvent } from "@/lib/appAnalytics";
import { Phase3ExecutiveTracker } from "@/components/onboarding/phase3/Phase3ExecutiveTracker";
import { Phase3FromEmailSummaryTracker } from "@/components/onboarding/phase3/Phase3FromEmailSummaryTracker";
import type { RoiSummaryResponse } from "@/features/roi/types";

function confidenceLabel(confidence: RoiSummaryResponse["metrics"]["prevented"]["confidence"]) {
  if (confidence === "confirmed_resolved") return "Confirmed resolved";
  if (confidence === "likely_prevented") return "Likely prevented";
  if (confidence === "observed") return "Observed";
  return "Estimated";
}

export default function ExecutiveROIPage() {
  const params = useSearchParams();
  const range = params.get("range") === "7d" ? "7d" : params.get("range") === "90d" ? "90d" : "30d";
  const [data, setData] = useState<RoiSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/insights/roi-summary?range=${range}`);
      const json = (await res.json().catch(() => null)) as RoiSummaryResponse | null;
      if (mounted) {
        setData(json);
        setLoading(false);
      }
    })();
    trackAppEvent("roi_section_view", { page: "insights_roi", range });
    return () => {
      mounted = false;
    };
  }, [range]);

  const roiData = data && data.ok ? data : null;
  const trendTone = useMemo(() => roiData?.impactSummary.trend ?? "stable", [roiData]);

  return (
    <Stack gap={6}>
      <Suspense fallback={null}>
        <Phase3FromEmailSummaryTracker />
      </Suspense>
      <Phase3ExecutiveTracker path="/executive/roi" />
      <PageHeaderV2
        breadcrumbs={[{ label: "Insights", href: "/insights" }, { label: "ROI" }]}
        title="Impact and outcomes"
        description="Evidence-based value signals showing prevented risk, resolved impact, and process improvement."
        helper="How Solvren is helping reduce risk and improve outcomes over time."
        helpTrigger={<PageHelpDrawer page="insights" />}
      />

      <Card>
        <CardBody>
          <SectionHeader
            title="Window"
            helper="Compare against the previous equal window."
            action={
              <div className="flex gap-2 text-sm">
                {(["7d", "30d", "90d"] as const).map((r) => (
                  <Link
                    key={r}
                    href={`/insights/roi?range=${r}`}
                    onClick={() => trackAppEvent("roi_range_change", { source_page: "insights_roi", range: r })}
                    className={range === r ? "font-semibold text-[var(--primary)]" : "text-[var(--text-muted)]"}
                  >
                    {r}
                  </Link>
                ))}
              </div>
            }
          />
        </CardBody>
      </Card>

      {loading ? (
        <Card><CardBody><p className="text-sm text-[var(--text-muted)]">Loading impact data...</p></CardBody></Card>
      ) : roiData ? (
        <>
          <Grid cols={2} gap={4}>
            {[
              {
                heading: "Potential issues prevented",
                metric: roiData.metrics.prevented,
                key: "roi_prevented" as const,
              },
              {
                heading: "Issues resolved",
                metric: roiData.metrics.resolved,
                key: "roi_resolved" as const,
              },
              {
                heading: "High-risk changes reviewed",
                metric: roiData.metrics.governed,
                key: "roi_governed" as const,
              },
              {
                heading: "Risk trend improvement",
                metric: roiData.metrics.trend,
                key: "roi_trend" as const,
              },
            ].map((item) => (
              <Card
                key={item.heading}
                className="shadow-sm"
                onClick={() =>
                  trackAppEvent("roi_metric_open", {
                    source_page: "insights_roi",
                    metric_key: item.metric.key,
                    confidence: item.metric.confidence,
                    range,
                  })
                }
              >
                <CardBody>
                  <Stack gap={1}>
                    <p className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      {item.heading}
                      <MetricHelpTooltip metricKey={item.key} page="insights_roi" section="impact_and_outcomes" />
                    </p>
                    <p className="text-2xl font-semibold">{item.metric.displayValue}</p>
                    <p className="text-xs text-[var(--text-muted)]">{confidenceLabel(item.metric.confidence)}</p>
                    <p className="text-sm">{item.metric.valueStatement}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      How determined: {item.metric.howDetermined}
                    </p>
                  </Stack>
                </CardBody>
              </Card>
            ))}
          </Grid>

          <Card className="shadow-sm">
            <CardBody>
              <SectionHeader title="Operational efficiency" helper="Canonical operational KPI trend signals." />
              <Grid cols={3} gap={3}>
                {[roiData.kpis.overdueReduction, roiData.kpis.approvalLatencyTrend, roiData.kpis.issueResolutionTrend].map((kpi) => (
                  <Card key={kpi.key}>
                    <CardBody>
                      <p className="text-xs text-[var(--text-muted)]">{kpi.label}</p>
                      <p className="text-xl font-semibold">{kpi.displayValue}</p>
                      <p className="text-xs text-[var(--text-muted)]">{kpi.valueStatement}</p>
                    </CardBody>
                  </Card>
                ))}
              </Grid>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionHeader title="Value storytelling" helper="Traceable examples grounded in concrete evidence." />
              {roiData.stories.length === 0 ? (
                <EmptyState
                  variant="still_building"
                  title="Impact data is building"
                  body="As Solvren monitors more activity, this view will show how risk and outcomes are improving over time."
                />
              ) : (
                <Stack gap={2}>
                  {roiData.stories.map((story, position) => (
                    <Link
                      key={story.id}
                      href={story.href}
                      onClick={() => {
                        trackAppEvent("roi_example_open", {
                          source_page: "insights_roi",
                          confidence: story.confidence,
                          object_type: story.entityType,
                          object_id: story.entityId,
                          position,
                        });
                        trackAppEvent("roi_trace_click", {
                          source_page: "insights_roi",
                          destination: story.href,
                          object_type: story.entityType,
                          object_id: story.entityId,
                        });
                      }}
                      className="rounded-md border p-3 hover:bg-[var(--table-row-hover)]"
                    >
                      <p className="font-semibold">{story.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{confidenceLabel(story.confidence)}</p>
                      <p className="text-sm">{story.summary}</p>
                      <p className="text-xs text-[var(--text-muted)]">Why this counts: {story.whyThisCounts}</p>
                    </Link>
                  ))}
                </Stack>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionHeader title="Trend status" helper="Compact current signal for executive scanability." />
              <p className="text-lg font-semibold capitalize">{trendTone.replaceAll("_", " ")}</p>
              <p className="text-sm text-[var(--text-muted)]">
                As of {new Date(roiData.asOf).toLocaleString()} based on current {roiData.range} compared with the previous equal window.
              </p>
            </CardBody>
          </Card>
        </>
      ) : null}
      {!loading && !roiData ? (
        <>
          <Card>
            <CardBody>
              <SectionHeader title="Value storytelling" helper="Traceable examples grounded in concrete evidence." />
              <EmptyState
                variant="still_building"
                title="Impact data is building"
                body="As Solvren monitors more activity, this view will show how risk and outcomes are improving over time."
              />
            </CardBody>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
