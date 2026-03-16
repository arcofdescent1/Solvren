import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeSignalStatsV2 } from "@/services/risk/recomputeSignalStatsV2";
import { trainOrgDomainModel } from "@/services/risk/ml/trainOrgModel";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (env.cronSecret && secret !== env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id")
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const windowDays = Number(new URL(req.url || "/").searchParams.get("windowDays") ?? "90");
  const halfLifeDays = Number(new URL(req.url || "/").searchParams.get("halfLifeDays") ?? "60");

  const results: { orgId: string; ok: boolean; signals?: number; trained?: boolean; error?: string }[] = [];
  for (const org of orgs ?? []) {
    try {
      const orgId = org.id as string;
      const r = await recomputeSignalStatsV2(supabase, {
        orgId,
        domain: "REVENUE",
        modelVersion: 1,
        windowDays,
        halfLifeDays,
      });

      const { data: settings } = await supabase
        .from("organization_settings")
        .select("enable_ml_scoring")
        .eq("org_id", orgId)
        .maybeSingle();
      const enableMl = Boolean(settings?.enable_ml_scoring ?? false);

      const trainResult = await trainOrgDomainModel(supabase, {
        orgId,
        domainKey: "REVENUE",
        enableMl,
      });

      results.push({
        orgId,
        ok: true,
        signals: r.signals,
        trained: trainResult.trained,
      });
    } catch (e: unknown) {
      results.push({
        orgId: org.id as string,
        ok: false,
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
