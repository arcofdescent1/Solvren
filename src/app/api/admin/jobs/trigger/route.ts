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
} as const;

type JobKey = keyof typeof JOB_PATHS;

type Body = {
  orgId: string;
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

  if (!body.orgId || !body.job || !(body.job in JOB_PATHS)) {
    return NextResponse.json({ error: "orgId and valid job required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", body.orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole(member.role ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cronSecret = env.cronSecret;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 503 });
  }

  const path = JOB_PATHS[body.job];
  const res = await fetch(`${env.appUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
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
