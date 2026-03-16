import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

async function assertAdmin(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("No org membership");
  if (!isAdminLikeRole(parseOrgRole(data.role ?? null)))
    throw new Error("Forbidden");
  return data.org_id as string;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await assertAdmin(supabase, userRes.user.id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const [domains, sla, signals, mitigations] = await Promise.all([
    supabase
      .from("domains")
      .select("key,name,description,is_active")
      .order("key", { ascending: true }),
    supabase
      .from("domain_sla_policies")
      .select(
        "domain_key,policy_key,due_hours,due_soon_hours,escalation_hours"
      ),
    supabase
      .from("domain_signals")
      .select(
        "domain_key,signal_key,name,description,severity,default_weight,detector"
      ),
    supabase
      .from("domain_signal_mitigations")
      .select(
        "domain_key,signal_key,mitigation_key,recommendation,severity"
      ),
  ]);

  const anyErr = domains.error || sla.error || signals.error || mitigations.error;
  if (anyErr) {
    return NextResponse.json(
      { error: anyErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    domains: domains.data ?? [],
    slaPolicies: sla.data ?? [],
    signals: signals.data ?? [],
    mitigations: mitigations.data ?? [],
  });
}
