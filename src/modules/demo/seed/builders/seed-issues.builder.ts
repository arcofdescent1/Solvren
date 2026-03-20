/**
 * Phase 8 — Issues seed builder.
 */
import { ts, seededUuid } from "./seed-helpers";

type IssueInsert = Record<string, unknown>;

export type SeedIssueInput = {
  orgId: string;
  scenarioKey: string;
  seedVersion: string;
  baseIndex: number;
  domainKey: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "triaged" | "assigned" | "in_progress" | "resolved" | "verified" | "dismissed";
  sourceType: "detector" | "integration_event" | "manual" | "change" | "incident" | "system_health" | "verification_failure";
  sourceRef: string;
  daysAgo?: number;
};

export function buildSeedIssues(input: SeedIssueInput[]): IssueInsert[] {
  return input.map((i, idx) => {
    const daysAgo = i.daysAgo ?? 3;
    const eventTime = ts(-daysAgo);
    const issueKey = `DEMO-${i.scenarioKey.replace(/_/g, "").slice(0, 4).toUpperCase()}-${String(1000 + i.baseIndex + idx).slice(-4)}`;
    const issueId = seededUuid(`issue:${i.orgId}:${issueKey}`);

    const insert: IssueInsert = {
      id: issueId,
      org_id: i.orgId,
      issue_key: issueKey,
      source_type: i.sourceType,
      source_ref: i.sourceRef,
      source_event_time: eventTime,
      domain_key: i.domainKey,
      title: i.title,
      description: i.description,
      severity: i.severity,
      status: i.status,
      verification_status: i.status === "verified" ? "passed" : i.status === "resolved" ? "passed" : "pending",
      priority_score: i.severity === "critical" ? 95 : i.severity === "high" ? 80 : i.severity === "medium" ? 60 : 40,
      impact_score: i.severity === "critical" ? 90 : i.severity === "high" ? 75 : 50,
      confidence_score: 0.9,
      opened_at: eventTime,
      updated_at: ts(-daysAgo + 1),
    };

    if (i.status === "resolved" || i.status === "verified") {
      insert.resolved_at = ts(-daysAgo + 2);
      insert.verified_at = i.status === "verified" ? ts(-daysAgo + 2, 2) : undefined;
    }
    return insert;
  });
}
