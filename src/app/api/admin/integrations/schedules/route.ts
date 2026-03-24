/**
 * Phase 3 — Admin: list/create schedules for provider.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";
import { getNextRunAt } from "@/modules/integrations/scheduling/cronResolver";

export async function GET(req: NextRequest) {
  try {
    await requireAnyOrgPermission("integrations.manage");
    const provider = req.nextUrl.searchParams.get("provider");
    const orgId = req.nextUrl.searchParams.get("orgId");

    const admin = createAdminClient();
    let q = admin.from("integration_sync_schedules").select("*, integration_accounts(provider, org_id)");
    if (orgId) q = q.eq("org_id", orgId);

    const { data, error } = await q.order("next_run_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    let schedules = (data ?? []) as Array<Record<string, unknown> & { integration_accounts?: { provider?: string } | null }>;
    if (provider) schedules = schedules.filter((s) => (s.integration_accounts as { provider?: string })?.provider === provider);
    return NextResponse.json({ ok: true, schedules });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("integrations.manage");
    const body = await req.json().catch(() => ({})) as {
      orgId: string;
      integrationAccountId: string;
      jobType: string;
      cronExpression: string;
      timezone?: string;
    };

    if (!body.orgId || !body.integrationAccountId || !body.jobType || !body.cronExpression) {
      return NextResponse.json({ error: "orgId, integrationAccountId, jobType, cronExpression required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const nextRun = getNextRunAt(body.cronExpression, new Date(), body.timezone ?? "UTC");

    const { data, error } = await admin
      .from("integration_sync_schedules")
      .insert({
        org_id: body.orgId,
        integration_account_id: body.integrationAccountId,
        job_type: body.jobType,
        cron_expression: body.cronExpression,
        timezone: body.timezone ?? "UTC",
        enabled: true,
        next_run_at: nextRun.toISOString(),
        created_by: ctx.user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, schedule: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
