/**
 * Phase 10 — Build playbook performance snapshots.
 * Aggregates workflow_runs, outcomes into playbook_performance_snapshots.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { computePerformanceScore, classifyHealthState } from "../services/playbook-performance.service";

const SNAPSHOT_WINDOW_HOURS = 24;

type Def = { id: string; playbook_key: string };
type Run = { id: string; issue_id: string | null; run_status: string; started_at: string; completed_at: string | null };

export async function runBuildPlaybookPerformanceSnapshots(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - SNAPSHOT_WINDOW_HOURS * 60 * 60 * 1000);

  const { data: configs } = await admin
    .from("org_playbook_configs")
    .select("org_id, playbook_definition_id")
    .eq("enabled", true);

  if (!configs?.length) {
    return { success: 0, failed: 0, errors: [] };
  }

  const { data: definitions } = await admin
    .from("playbook_definitions")
    .select("id, playbook_key");

  const defs = (definitions ?? []) as Def[];
  const defById = new Map(defs.map((d) => [d.id, d.playbook_key]));

  const orgPlaybooks = new Map<string, string[]>();
  for (const c of configs as { org_id: string; playbook_definition_id: string }[]) {
    const key = defById.get(c.playbook_definition_id);
    if (key) {
      const list = orgPlaybooks.get(c.org_id) ?? [];
      if (!list.includes(key)) list.push(key);
      orgPlaybooks.set(c.org_id, list);
    }
  }

  for (const [orgId, playbookKeys] of orgPlaybooks) {
    for (const playbookKey of playbookKeys) {
      try {
        const playbookDefIds = defs.filter((d) => d.playbook_key === playbookKey).map((d) => d.id);
        if (!playbookDefIds.length) continue;

        const { data: allRuns } = await admin
          .from("workflow_runs")
          .select("id, issue_id, run_status, started_at, completed_at")
          .eq("org_id", orgId)
          .in("playbook_definition_id", playbookDefIds)
          .gte("started_at", windowStart.toISOString())
          .lte("started_at", windowEnd.toISOString());

        const runList = (allRuns ?? []) as Run[];

        const runCount = runList.length;
        const successCount = runList.filter((r) => r.run_status === "completed").length;
        const failureCount = runList.filter((r) => r.run_status === "failed").length;
        const partialCount = runList.filter((r) => r.run_status === "partial" || r.run_status === "partial_success").length;

        const issueIds = runList.map((r) => r.issue_id).filter(Boolean) as string[];

        let recoveredAmount = 0;
        let avoidedAmount = 0;
        let savingsAmount = 0;

        if (issueIds.length > 0) {
          const { data: outcomeRows } = await admin
            .from("outcomes")
            .select("outcome_type, amount")
            .in("issue_id", issueIds)
            .gte("created_at", windowStart.toISOString());

          for (const o of (outcomeRows ?? []) as Array<{ outcome_type: string; amount: number }>) {
            if (o.outcome_type === "recovered_revenue") recoveredAmount += Number(o.amount) || 0;
            else if (o.outcome_type === "avoided_loss") avoidedAmount += Number(o.amount) || 0;
            else if (o.outcome_type === "operational_savings") savingsAmount += Number(o.amount) || 0;
          }
        }

        let avgTimeToResolution: number | null = null;
        const completedRuns = runList.filter((r) => r.run_status === "completed" && r.started_at && r.completed_at);
        if (completedRuns.length > 0) {
          const totalSec = completedRuns.reduce((acc, r) => {
            const start = new Date(r.started_at).getTime();
            const end = new Date(r.completed_at!).getTime();
            return acc + (end - start) / 1000;
          }, 0);
          avgTimeToResolution = totalSec / completedRuns.length;
        }

        const verificationSuccessRate = runCount > 0 ? successCount / runCount : null;
        const failureRate = runCount > 0 ? failureCount / runCount : 0;
        const healthState = classifyHealthState(runCount, verificationSuccessRate, failureRate);

        const performanceScore = computePerformanceScore({
          recoveredAmount,
          avoidedAmount,
          savingsAmount,
          runCount,
          successCount,
          failureCount,
          verificationSuccessRate: verificationSuccessRate ?? undefined,
          avgTimeToResolutionSeconds: avgTimeToResolution ?? undefined,
        });

        const reasons: string[] = [];
        if (runCount < 3) reasons.push("insufficient_runs");
        if (failureRate > 0.2) reasons.push("elevated_failures");

        const { error } = await admin.from("playbook_performance_snapshots").insert({
          org_id: orgId,
          playbook_key: playbookKey,
          snapshot_window_start: windowStart.toISOString(),
          snapshot_window_end: windowEnd.toISOString(),
          run_count: runCount,
          success_count: successCount,
          failure_count: failureCount,
          partial_success_count: partialCount,
          recovered_amount: recoveredAmount,
          avoided_amount: avoidedAmount,
          savings_amount: savingsAmount,
          realized_loss_amount: 0,
          avg_time_to_resolution_seconds: avgTimeToResolution,
          verification_success_rate: verificationSuccessRate,
          automation_rate: null,
          approval_rate: null,
          performance_score: performanceScore,
          health_state: healthState,
          reasons_json: reasons,
          metrics_json: {},
        });

        if (error) {
          failed++;
          errors.push(`${orgId}/${playbookKey}: ${error.message}`);
        } else {
          success++;
        }
      } catch (err) {
        failed++;
        errors.push(`${orgId}/${playbookKey}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { success, failed, errors };
}
