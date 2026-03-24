/**
 * Phase 3 — Issue context for action execution.
 * Fetches issue + revenue at risk for Slack summaries, Jira descriptions, etc.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IssueContext = {
  id: string;
  org_id: string;
  issue_key: string;
  title: string;
  description: string | null;
  summary: string | null;
  severity: string;
  revenueAtRisk: number;
  createdAt: string;
};

export async function getIssueContext(
  supabase: SupabaseClient,
  issueId: string
): Promise<IssueContext | null> {
  const { data: issue, error: issueErr } = await supabase
    .from("issues")
    .select("id, org_id, issue_key, title, description, summary, severity, opened_at")
    .eq("id", issueId)
    .single();

  if (issueErr || !issue) return null;

  const row = issue as {
    id: string;
    org_id: string;
    issue_key: string;
    title: string;
    description: string | null;
    summary: string | null;
    severity: string;
    opened_at: string;
  };

  const { data: impact } = await supabase
    .from("issue_impact_summaries")
    .select("current_revenue_at_risk_amount")
    .eq("issue_id", issueId)
    .maybeSingle();

  const revenueAtRisk = Number((impact as { current_revenue_at_risk_amount?: number } | null)?.current_revenue_at_risk_amount ?? 0);

  return {
    id: row.id,
    org_id: row.org_id,
    issue_key: row.issue_key,
    title: row.title,
    description: row.description,
    summary: row.summary,
    severity: row.severity,
    revenueAtRisk,
    createdAt: row.opened_at,
  };
}

/** Format issue summary for Slack message. */
export function formatIssueSummaryForSlack(ctx: IssueContext): string {
  const lines: string[] = [
    `🚨 *Issue Detected: ${ctx.title}*`,
    `• Issue: ${ctx.issue_key}`,
    `• Severity: ${ctx.severity}`,
  ];
  if (ctx.revenueAtRisk > 0) {
    lines.push(`• Revenue at Risk: $${ctx.revenueAtRisk.toLocaleString()}`);
  }
  if (ctx.summary) {
    lines.push(`\n${ctx.summary}`);
  }
  return lines.join("\n");
}
