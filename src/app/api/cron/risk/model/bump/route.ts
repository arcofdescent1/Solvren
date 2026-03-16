import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (env.cronSecret && secret !== env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({})) as { orgId?: string };
  const orgId = body?.orgId as string;
  if (!orgId)
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const { data: maxRow } = await supabase
    .from("signal_stats")
    .select("model_version")
    .eq("org_id", orgId)
    .eq("domain", "REVENUE")
    .order("model_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentVersion = Number(maxRow?.model_version ?? 1);
  const nextVersion = currentVersion + 1;

  const { data: rows } = await supabase
    .from("signal_stats")
    .select("signal_key")
    .eq("org_id", orgId)
    .eq("domain", "REVENUE")
    .eq("model_version", currentVersion);

  for (const r of rows ?? []) {
    await supabase.from("signal_stats").upsert(
      {
        org_id: orgId,
        domain: "REVENUE",
        signal_key: (r as { signal_key: string }).signal_key,
        model_version: nextVersion,
        total_changes: 0,
        incident_changes: 0,
        total_revenue_at_risk: 0,
        incident_revenue_at_risk: 0,
        incident_rate: 0,
        revenue_incident_rate: 0,
        learned_multiplier: 1.0,
        learned_multiplier_reason: {
          mode: "RESET",
          fromVersion: currentVersion,
        },
        baseline_frozen_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,domain,signal_key,model_version" }
    );
  }

  await supabase.from("risk_model_versions").insert({
    org_id: orgId,
    domain: "REVENUE",
    model_version: nextVersion,
    note: "Model version bumped",
    metadata: { type: "bump", fromVersion: currentVersion },
  });

  return NextResponse.json({
    ok: true,
    orgId,
    from: currentVersion,
    to: nextVersion,
  });
}
