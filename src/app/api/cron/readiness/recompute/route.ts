/**
 * Phase 5 — Recompute readiness scores and predictions (scheduled + queue drain).
 * POST /api/cron/readiness/recompute
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { recomputeOrganizationReadiness } from "@/lib/readiness/recomputeOrg";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  try {
    const admin = createAdminClient();
    const { data: orgs, error } = await admin.from("organizations").select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const orgIds = (orgs ?? []).map((o) => (o as { id: string }).id);
    let totalChanges = 0;
    const errors: string[] = [];

    for (const orgId of orgIds) {
      try {
        const { changesProcessed } = await recomputeOrganizationReadiness(admin, orgId);
        totalChanges += changesProcessed;
      } catch (e) {
        errors.push(`${orgId}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      orgsProcessed: orgIds.length,
      changeScopesTouched: totalChanges,
      errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Readiness recompute failed" },
      { status: 500 }
    );
  }
}
