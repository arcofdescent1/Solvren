/**
 * Phase 3 — Cron: run due integration sync schedules.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { getDueSchedules, executeDueSchedule } from "@/modules/integrations/scheduling/scheduleOrchestrator";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const due = await getDueSchedules(admin, new Date());
  let executed = 0;
  let failed = 0;

  for (const s of due) {
    const result = await executeDueSchedule(admin, s.id);
    if (result.ok) executed++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    due: due.length,
    executed,
    failed,
  });
}
