/**
 * Phase 5 — Backfill impact assessments for orgs.
 * POST /api/cron/impact/backfill
 * Body: { orgId?: string } — if omitted, processes all orgs
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { backfillImpactAssessments } from "@/modules/impact/jobs/backfill-impact-assessments.job";

export async function POST(req: Request) {
  const authFailure = requireCronSecret(req);
  if (authFailure) return authFailure;

  try {
    const supabase = createAdminClient();
    let body: { orgId?: string } = {};
    try {
      body = (await req.json()) as { orgId?: string };
    } catch {
      /* empty body ok */
    }

    if (body.orgId) {
      const result = await backfillImpactAssessments(supabase, body.orgId);
      return NextResponse.json({ ok: true, ...result });
    }

    const { data: orgs } = await supabase.from("organizations").select("id");
    const results: Array<{ orgId: string; processed: number; succeeded: number; errors: number }> = [];
    for (const o of orgs ?? []) {
      const orgId = (o as { id: string }).id;
      const r = await backfillImpactAssessments(supabase, orgId, 25);
      results.push({ orgId, ...r });
    }
    return NextResponse.json({ ok: true, orgs: results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
