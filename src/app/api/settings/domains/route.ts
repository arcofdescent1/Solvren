import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isTableMissingError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("relation") && msg.includes("not found")
  );
}

export async function GET() {
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

  let domains: Array<{ key: string; name: string; description: string | null; is_active: boolean }> = [];
  let orgDomains: Array<{ domain_key: string; enabled: boolean; config: unknown }> = [];
  let orgPolicies: Array<{ domain_key: string; sla_policy_key: string; config: unknown }> = [];
  let slaPolicies: Array<{ domain_key: string; policy_key: string; due_hours: number; due_soon_hours: number; escalation_hours: number }> = [];
  let domainSignals: Array<{ domain_key: string; signal_key: string; name: string; description: string | null; severity: string; default_weight: number }> = [];
  let overrides: Array<{ domain_key: string; signal_key: string; enabled: boolean; weight_override: number | null }> = [];

  const { data: domainsData, error: dErr } = await supabase
    .from("domains")
    .select("key,name,description,is_active")
    .eq("is_active", true)
    .order("key", { ascending: true });

  if (dErr) {
    if (isTableMissingError(dErr)) {
      return NextResponse.json({
        orgId,
        schemaAvailable: false,
        domains: [],
        orgDomains: [],
        orgPolicies: [],
        slaPolicies: [],
        domainSignals: [],
        overrides: [],
      });
    }
    return NextResponse.json({ error: dErr.message }, { status: 500 });
  }

  domains = domainsData ?? [];

  const { data: orgDomainsData, error: odErr } = await supabase
    .from("org_domains")
    .select("domain_key,enabled,config")
    .eq("org_id", orgId);

  if (!odErr) orgDomains = orgDomainsData ?? [];
  else if (!isTableMissingError(odErr))
    return NextResponse.json({ error: odErr.message }, { status: 500 });

  const { data: orgPoliciesData, error: opErr } = await supabase
    .from("org_domain_policies")
    .select("domain_key,sla_policy_key,config")
    .eq("org_id", orgId);

  if (!opErr) orgPolicies = orgPoliciesData ?? [];
  else if (!isTableMissingError(opErr))
    return NextResponse.json({ error: opErr.message }, { status: 500 });

  const { data: slaPoliciesData, error: spErr } = await supabase
    .from("domain_sla_policies")
    .select("domain_key,policy_key,due_hours,due_soon_hours,escalation_hours");

  if (!spErr) slaPolicies = slaPoliciesData ?? [];
  else if (!isTableMissingError(spErr))
    return NextResponse.json({ error: spErr.message }, { status: 500 });

  const { data: domainSignalsData, error: dsErr } = await supabase
    .from("domain_signals")
    .select("domain_key,signal_key,name,description,severity,default_weight")
    .order("domain_key", { ascending: true });

  if (!dsErr) domainSignals = domainSignalsData ?? [];
  else if (!isTableMissingError(dsErr))
    return NextResponse.json({ error: dsErr.message }, { status: 500 });

  const { data: overridesData, error: ovErr } = await supabase
    .from("org_signal_overrides")
    .select("domain_key,signal_key,enabled,weight_override")
    .eq("org_id", orgId);

  if (!ovErr) overrides = overridesData ?? [];
  else if (!isTableMissingError(ovErr))
    return NextResponse.json({ error: ovErr.message }, { status: 500 });

  return NextResponse.json({
    orgId,
    schemaAvailable: true,
    domains: domains ?? [],
    orgDomains: orgDomains ?? [],
    orgPolicies: orgPolicies ?? [],
    slaPolicies: slaPolicies ?? [],
    domainSignals: domainSignals ?? [],
    overrides: overrides ?? [],
  });
}
