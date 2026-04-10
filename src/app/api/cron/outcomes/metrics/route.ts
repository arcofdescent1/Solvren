import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { recomputeOutcomeMetricsForPeriod } from "@/lib/outcomes/calculateOutcomeMetrics";

/** POST /api/cron/outcomes/metrics — recompute current month + quarter per org */
export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  try {
    const admin = createAdminClient();
    const { data: orgs, error } = await admin.from("organizations").select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ref = new Date();
    for (const o of orgs ?? []) {
      const orgId = (o as { id: string }).id;
      await recomputeOutcomeMetricsForPeriod({ admin, orgId, periodType: "MONTH", refDate: ref });
      await recomputeOutcomeMetricsForPeriod({ admin, orgId, periodType: "QUARTER", refDate: ref });
    }

    return NextResponse.json({ ok: true, orgs: (orgs ?? []).length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "outcomes metrics failed" },
      { status: 500 }
    );
  }
}
