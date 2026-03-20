/**
 * Phase 6 — Composite insights (B + C + E): benchmarks, recommendations, growth prompts, anomalies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BenchmarkResult } from "@/modules/benchmarking/domain/benchmark-result";
import { listCustomerVisibleBenchmarkResults } from "@/modules/benchmarking/services/benchmark-query.service";
import { getRecommendations } from "@/modules/onboarding/services/recommendation.service";
import { getCalibrationForOrg } from "./confidence-calibration.service";

export type GrowthPrompt = {
  kind: "playbook" | "integration" | "detector" | "automation" | "team";
  title: string;
  description: string;
  href?: string;
  priority: number;
};

export type InsightAnomaly = {
  id: string;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
};

export type InsightsBundle = {
  orgId: string;
  growthPrompts: GrowthPrompt[];
  onboardingRecommendations: Array<{
    type: string;
    title: string;
    description: string;
    href?: string;
    priority: number;
  }>;
  benchmarks: BenchmarkResult[];
  anomalies: InsightAnomaly[];
  intelligence: Awaited<ReturnType<typeof getCalibrationForOrg>>;
};

function toGrowthPrompts(
  recs: Awaited<ReturnType<typeof getRecommendations>>["recommendations"]
): GrowthPrompt[] {
  return recs.map((r) => ({
    kind:
      r.type === "integration"
        ? "integration"
        : r.type === "detector"
          ? "detector"
          : r.type === "playbook"
            ? "playbook"
            : "automation",
    title: r.title,
    description: r.reason,
    href: r.href,
    priority: r.priority,
  }));
}

export async function buildInsightsBundle(
  supabase: SupabaseClient,
  orgId: string
): Promise<InsightsBundle> {
  const [{ recommendations }, { data: benchmarks }, calibration] = await Promise.all([
    getRecommendations(supabase, orgId),
    listCustomerVisibleBenchmarkResults(supabase, orgId),
    getCalibrationForOrg(supabase, orgId),
  ]);

  const onboardingRecommendations = recommendations.map((r) => ({
    type: r.type,
    title: r.title,
    description: r.reason,
    href: r.href,
    priority: r.priority,
  }));

  const growthPrompts = toGrowthPrompts(recommendations);

  if (growthPrompts.length === 0) {
    growthPrompts.push({
      kind: "team",
      title: "Invite your team",
      description:
        "Add operators and reviewers so revenue workflows stay covered.",
      href: "/settings/organization",
      priority: 40,
    });
  }

  const anomalies: InsightAnomaly[] = [];

  const { count: criticalOpen } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "open")
    .eq("severity", "critical");

  if ((criticalOpen ?? 0) > 0) {
    anomalies.push({
      id: "open-critical-issues",
      title: "Critical issues open",
      detail: `${criticalOpen} critical issue(s) require executive attention.`,
      severity: "high",
    });
  }

  const underperforming = benchmarks.filter(
    (b) =>
      b.safeToDisplay &&
      b.customerValue != null &&
      b.normalizedGap != null &&
      b.normalizedGap < 0
  );
  for (const b of underperforming.slice(0, 3)) {
    anomalies.push({
      id: `benchmark-${b.metricKey}`,
      title: `Below cohort on ${b.displayName}`,
      detail: b.explanationText,
      severity: "medium",
    });
  }

  return {
    orgId,
    growthPrompts,
    onboardingRecommendations,
    benchmarks,
    anomalies,
    intelligence: calibration,
  };
}
