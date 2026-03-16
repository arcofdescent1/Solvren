import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isTableMissingError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("not found"))
  );
}

type Body =
  | { type: "DOMAIN_TOGGLE"; domainKey: string; enabled: boolean }
  | { type: "SLA_POLICY"; domainKey: string; policyKey: string }
  | {
      type: "SIGNAL_OVERRIDE";
      domainKey: string;
      signalKey: string;
      enabled: boolean;
      weightOverride: number | null;
    };

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: orgRow, error: orgErr } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });
  const orgId = orgRow?.org_id as string;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type === "DOMAIN_TOGGLE") {
    const { domainKey, enabled } = body;

    const { error } = await supabase.from("org_domains").upsert(
      { org_id: orgId, domain_key: domainKey, enabled, config: {} },
      { onConflict: "org_id,domain_key" }
    );

    if (error) {
      if (isTableMissingError(error))
        return NextResponse.json(
          { error: "Domain management is not configured. The database tables (org_domains, domains) are missing. Run migrations to enable domain settings." },
          { status: 503 }
        );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (enabled) {
      const polErr = (await supabase.from("org_domain_policies").upsert(
        { org_id: orgId, domain_key: domainKey, sla_policy_key: "DEFAULT", config: {} },
        { onConflict: "org_id,domain_key" }
      )).error;
      if (polErr && isTableMissingError(polErr))
        return NextResponse.json(
          { error: "Domain management is not configured. Run migrations to enable domain settings." },
          { status: 503 }
        );
    }

    return NextResponse.json({ ok: true });
  }

  if (body.type === "SLA_POLICY") {
    const { domainKey, policyKey } = body;

    const { error } = await supabase.from("org_domain_policies").upsert(
      { org_id: orgId, domain_key: domainKey, sla_policy_key: policyKey, config: {} },
      { onConflict: "org_id,domain_key" }
    );

    if (error) {
      if (isTableMissingError(error))
        return NextResponse.json(
          { error: "Domain management is not configured. Run migrations to enable domain settings." },
          { status: 503 }
        );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.type === "SIGNAL_OVERRIDE") {
    const { domainKey, signalKey, enabled, weightOverride } = body;

    const w =
      weightOverride == null ? null : Math.max(0.3, Math.min(3.0, Number(weightOverride)));

    const { error } = await supabase.from("org_signal_overrides").upsert(
      {
        org_id: orgId,
        domain_key: domainKey,
        signal_key: signalKey,
        enabled,
        weight_override: w,
        config_override: {},
      },
      { onConflict: "org_id,domain_key,signal_key" }
    );

    if (error) {
      if (isTableMissingError(error))
        return NextResponse.json(
          { error: "Domain management is not configured. Run migrations to enable domain settings." },
          { status: 503 }
        );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown update type" }, { status: 400 });
}
