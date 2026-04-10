/**
 * Phase 5 — Persist readiness trend snapshots (every 6h).
 * POST /api/cron/readiness/snapshots
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  try {
    const admin = createAdminClient();
    const { data: orgs, error: orgErr } = await admin.from("organizations").select("id");
    if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });

    const nowIso = new Date().toISOString();
    let rowsInserted = 0;
    const errors: string[] = [];

    for (const o of orgs ?? []) {
      const orgId = (o as { id: string }).id;
      const { data: scores, error: scErr } = await admin
        .from("readiness_scores")
        .select("scope_type, scope_id, readiness_score, readiness_level")
        .eq("org_id", orgId);
      if (scErr) {
        errors.push(`${orgId}: ${scErr.message}`);
        continue;
      }
      for (const s of scores ?? []) {
        const row = s as {
          scope_type: string;
          scope_id: string;
          readiness_score: number;
          readiness_level: string;
        };
        const { error: insErr } = await admin.from("readiness_snapshots").insert({
          org_id: orgId,
          scope_type: row.scope_type,
          scope_id: row.scope_id,
          readiness_score: row.readiness_score,
          readiness_level: row.readiness_level,
          captured_at: nowIso,
        });
        if (insErr) {
          errors.push(`${orgId}/${row.scope_type}: ${insErr.message}`);
        } else {
          rowsInserted += 1;
        }
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      rowsInserted,
      errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Snapshot job failed" },
      { status: 500 }
    );
  }
}
