import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { env } from "@/lib/env";

const JOB_PATHS = {
  notifications_process: "/api/notifications/process",
  slack_deliveries_process: "/api/integrations/slack/deliveries/process",
  sla_tick: "/api/sla/tick",
  inbox_daily: "/api/inbox/daily/run",
  digests_weekly: "/api/digests/weekly/run",
  identity_recompute_preferred: "/api/identity/jobs/recompute-preferred",
  identity_rebuild_relationships: "/api/identity/jobs/rebuild-relationships",
  identity_stale_candidate_sweep: "/api/identity/jobs/stale-candidate-sweep",
  signals_process: "/api/admin/signals/process",
  detectors_run_scheduled: "/api/cron/detectors/run-scheduled",
  impact_recalculate: "/api/cron/impact/recalculate",
  impact_backfill: "/api/cron/impact/backfill",
  simulations_run: "/api/admin/simulations/run",
  integrations_refresh_health: "/api/cron/integrations/refresh-health",
} as const;

type JobKey = keyof typeof JOB_PATHS;

const ORG_JOBS: JobKey[] = [
  "identity_recompute_preferred",
  "identity_rebuild_relationships",
  "identity_stale_candidate_sweep",
  "signals_process",
  "impact_backfill",
];

type Body = {
  orgId?: string;
  job: JobKey;
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.job || !(body.job in JOB_PATHS)) {
    return NextResponse.json({ error: "valid job required" }, { status: 400 });
  }

  const needsOrgId = ORG_JOBS.includes(body.job as JobKey);
  if (needsOrgId && !body.orgId) {
    return NextResponse.json({ error: "orgId required for this job" }, { status: 400 });
  }

  // Permission: admin of specified org, or for global jobs, admin of any org
  if (body.orgId) {
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", body.orgId)
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (!member || !isAdminLikeRole(parseOrgRole(member.role ?? null))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const { data: members } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", userRes.user.id);
    const hasAdmin = (members ?? []).some((m) =>
      isAdminLikeRole(parseOrgRole((m as { role?: string | null }).role ?? null))
    );
    if (!hasAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const cronSecret = env.cronSecret;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 503 });
  }

  const path = JOB_PATHS[body.job];
  const bodyPayload = ORG_JOBS.includes(body.job) ? { orgId: body.orgId } : {};
  const res = await fetch(`${env.appUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: (json as { error?: string }).error ?? "Job failed" },
      { status: res.status }
    );
  }

  return NextResponse.json({ ok: true, job: body.job, result: json });
}
