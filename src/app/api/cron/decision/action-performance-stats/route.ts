/**
 * Phase 5 — Cron: refresh action_performance_stats (§25).
 * Run every 15 minutes. Aggregates from integration_action_executions.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

const WINDOW_DAYS_ORG_FAMILY = 90;
const WINDOW_DAYS_ORG = 180;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = env.cronSecret;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS_ORG);

  const { data: executions, error: execError } = await admin
    .from("integration_action_executions")
    .select("id, org_id, issue_id, action_key, execution_status, created_at, updated_at")
    .gte("created_at", windowStart.toISOString())
    .in("execution_status", [
      "SUCCESS",
      "PARTIAL_SUCCESS",
      "VERIFIED",
      "FAILED",
      "DEAD_LETTERED",
    ]);

  if (execError) {
    return NextResponse.json({ error: execError.message }, { status: 500 });
  }

  const rows = (executions ?? []) as Array<{
    id: string;
    org_id: string;
    issue_id: string | null;
    action_key: string;
    execution_status: string;
    created_at: string;
    updated_at: string;
  }>;

  const issueIds = [...new Set(rows.map((r) => r.issue_id).filter(Boolean))] as string[];
  const issueFamilyMap = new Map<string, string>();
  if (issueIds.length > 0) {
    const { data: issues } = await admin
      .from("issues")
      .select("id, domain_key")
      .in("id", issueIds);
    for (const i of issues ?? []) {
      issueFamilyMap.set((i as { id: string }).id, (i as { domain_key: string }).domain_key ?? "");
    }
  }

  type Agg = {
    org_id: string | null;
    action_key: string;
    issue_family: string | null;
    sample_count: number;
    success_count: number;
    failure_count: number;
  };
  const agg = new Map<string, Agg>();

  for (const r of rows) {
    const success =
      r.execution_status === "SUCCESS" ||
      r.execution_status === "PARTIAL_SUCCESS" ||
      r.execution_status === "VERIFIED";
    const issueFamily = r.issue_id ? issueFamilyMap.get(r.issue_id) ?? null : null;

    if (issueFamily) {
      const keyOrgFamily = `${r.org_id}|${r.action_key}|${issueFamily}`;
      const a1 = agg.get(keyOrgFamily);
      if (a1) {
        a1.sample_count++;
        if (success) a1.success_count++;
        else a1.failure_count++;
      } else {
        agg.set(keyOrgFamily, {
          org_id: r.org_id,
          action_key: r.action_key,
          issue_family: issueFamily,
          sample_count: 1,
          success_count: success ? 1 : 0,
          failure_count: success ? 0 : 1,
        });
      }
    }

    const keyOrg = `${r.org_id}|${r.action_key}`;
    const a2 = agg.get(keyOrg);
    if (a2) {
      a2.sample_count++;
      if (success) a2.success_count++;
      else a2.failure_count++;
    } else {
      agg.set(keyOrg, {
        org_id: r.org_id,
        action_key: r.action_key,
        issue_family: null,
        sample_count: 1,
        success_count: success ? 1 : 0,
        failure_count: success ? 0 : 1,
      });
    }
  }

  const statWindowEnd = new Date();
  const statWindowStart = new Date();
  statWindowStart.setDate(statWindowStart.getDate() - WINDOW_DAYS_ORG_FAMILY);

  for (const a of agg.values()) {
    const { data: existing } = await admin
      .from("action_performance_stats")
      .select("id, sample_count, success_count, failure_count")
      .eq("action_key", a.action_key)
      .eq("org_id", a.org_id)
      .is("issue_family", a.issue_family)
      .maybeSingle();

    const row = {
      org_id: a.org_id,
      action_key: a.action_key,
      issue_family: a.issue_family,
      sample_count: a.sample_count,
      success_count: a.success_count,
      failure_count: a.failure_count,
      stat_window_start: statWindowStart.toISOString(),
      stat_window_end: statWindowEnd.toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await admin
        .from("action_performance_stats")
        .update(row)
        .eq("id", (existing as { id: string }).id);
    } else {
      await admin.from("action_performance_stats").insert(row);
    }
  }

  return NextResponse.json({
    ok: true,
    aggregations: agg.size,
    executionsProcessed: rows.length,
  });
}
