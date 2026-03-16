import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

/**
 * Admin/ops-only trigger for the SLA tick job. Calls the job endpoint with CRON_SECRET
 * so "Run now" in the UI works without exposing the secret to the client.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roles } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userRes.user.id);

  const allowed = (roles ?? []).some((r) =>
    isAdminLikeRole(parseOrgRole((r as { role?: string }).role ?? null))
  );
  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cronSecret = env.cronSecret;
  if (!cronSecret)
    return NextResponse.json(
      { error: "CRON_SECRET not configured; cannot trigger job" },
      { status: 503 }
    );

  const base = env.appUrl.replace(/\/$/, "");
  const url = `${base}/api/sla/tick`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    return NextResponse.json(
      { error: (json as { error?: string })?.error ?? "Job failed" },
      { status: res.status }
    );
  return NextResponse.json(json);
}
