/**
 * Phase 2 — Builds immutable input snapshots for simulation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  insertInputSnapshot,
  type SnapshotType,
} from "../repositories/simulation-input-snapshots.repository";

export type HistoricalWindow = {
  start: string;
  end: string;
};

export type SnapshotScope = {
  issueFamily?: string;
  detectorKeys?: string[];
  playbookKey?: string;
  issueIds?: string[];
};

export type SnapshotBuildResult = {
  snapshotId: string;
  warnings: string[];
};

export async function buildHistoricalWindowSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  window: HistoricalWindow,
  scope: SnapshotScope
): Promise<{ data: SnapshotBuildResult | null; error: Error | null }> {
  const warnings: string[] = [];

  const issuesQuery = supabase
    .from("issues")
    .select("id, org_id, issue_key, source_type, domain_key, title, severity, status, lifecycle_state, opened_at, priority_score, impact_score, confidence_score")
    .eq("org_id", orgId)
    .gte("opened_at", window.start)
    .lte("opened_at", window.end);

  if (scope.issueIds?.length) {
    issuesQuery.in("id", scope.issueIds);
  }

  const { data: issues, error: issuesErr } = await issuesQuery;
  if (issuesErr) return { data: null, error: issuesErr as unknown as Error };

  const issueList = (issues ?? []) as Record<string, unknown>[];
  if (issueList.length === 0 && !scope.issueIds?.length) {
    warnings.push("No issues in historical window");
  }

  const issueIds = issueList.map((i) => i.id as string);

  let findings: unknown[] = [];
  if (issueIds.length > 0) {
    const { data: fd } = await supabase
      .from("detector_findings")
      .select("*")
      .in("issue_id", issueIds);
    findings = (fd ?? []) as unknown[];
  }

  let signals: unknown[] = [];
  try {
    const { data: ns } = await supabase
      .from("normalized_signals")
      .select("id, signal_key, signal_time, org_id, primary_canonical_entity_id, dimensions_json, measures_json")
      .eq("org_id", orgId)
      .gte("signal_time", window.start)
      .lte("signal_time", window.end)
      .limit(5000);
    signals = (ns ?? []) as unknown[];
  } catch {
    warnings.push("normalized_signals table may not exist; using empty signals");
  }

  let entities: unknown[] = [];
  try {
    const { data: ie } = await supabase
      .from("issue_entities")
      .select("*")
      .in("issue_id", issueIds);
    entities = (ie ?? []) as unknown[];
  } catch {
    warnings.push("issue_entities may have limited data");
  }

  let actions: unknown[] = [];
  if (issueIds.length > 0) {
    const { data: ia } = await supabase
      .from("issue_actions")
      .select("*")
      .in("issue_id", issueIds);
    actions = (ia ?? []) as unknown[];
  }

  let outcomes: unknown[] = [];
  try {
    const { data: oc } = await supabase
      .from("outcomes")
      .select("*")
      .in("issue_id", issueIds)
      .limit(1000);
    outcomes = (oc ?? []) as unknown[];
  } catch {
    warnings.push("outcomes table may not exist; using empty outcomes");
  }

  const { data: snapshot, error: insertErr } = await insertInputSnapshot(supabase, {
    org_id: orgId,
    snapshot_type: "HISTORICAL_WINDOW" as SnapshotType,
    historical_window_start: window.start,
    historical_window_end: window.end,
    issues_snapshot_json: issueList,
    findings_snapshot_json: findings,
    signals_snapshot_json: signals,
    entities_snapshot_json: entities,
    actions_snapshot_json: actions,
    outcomes_snapshot_json: outcomes,
    source_metadata_json: {
      scope,
      issue_count: issueList.length,
      finding_count: findings.length,
      signal_count: signals.length,
    },
  });

  if (insertErr) return { data: null, error: insertErr };
  return { data: { snapshotId: snapshot!.id, warnings }, error: null };
}

export async function buildIssueSetSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  issueIds: string[]
): Promise<{ data: SnapshotBuildResult | null; error: Error | null }> {
  const warnings: string[] = [];
  if (issueIds.length === 0) return { data: null, error: new Error("issueIds required") as Error };

  const { data: issues } = await supabase
    .from("issues")
    .select("*")
    .eq("org_id", orgId)
    .in("id", issueIds);
  const issueList = (issues ?? []) as unknown[];

  const { data: fd } = await supabase.from("detector_findings").select("*").in("issue_id", issueIds);
  const { data: ia } = await supabase.from("issue_actions").select("*").in("issue_id", issueIds);

  const { data: snapshot, error } = await insertInputSnapshot(supabase, {
    org_id: orgId,
    snapshot_type: "ISSUE_SET" as SnapshotType,
    issues_snapshot_json: issueList,
    findings_snapshot_json: (fd ?? []) as unknown[],
    actions_snapshot_json: (ia ?? []) as unknown[],
    source_metadata_json: { issue_ids: issueIds },
  });

  if (error) return { data: null, error };
  return { data: { snapshotId: snapshot!.id, warnings }, error: null };
}

export async function buildDemoSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  scenarioKey: string
): Promise<{ data: SnapshotBuildResult | null; error: Error | null }> {
  const demoIssues = getDemoSeedData(scenarioKey);
  const { data: snapshot, error } = await insertInputSnapshot(supabase, {
    org_id: orgId,
    snapshot_type: "DEMO_SEED" as SnapshotType,
    issues_snapshot_json: demoIssues,
    source_metadata_json: { scenario_key: scenarioKey },
  });
  if (error) return { data: null, error };
  return { data: { snapshotId: snapshot!.id, warnings: [] }, error: null };
}

function getDemoSeedData(_scenarioKey: string): unknown[] {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return [
    {
      id: "demo-issue-1",
      org_id: "demo",
      issue_key: "ISS-DEMO-001",
      source_type: "detector",
      domain_key: "revenue_leakage",
      title: "Demo: Failed payment unrecovered",
      severity: "high",
      status: "open",
      lifecycle_state: "DETECTED",
      opened_at: weekAgo.toISOString(),
      priority_score: 85,
    },
  ];
}
