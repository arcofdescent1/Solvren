import { NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET() {
  try {
    const ctx = await requireAnyOrgPermission("domains.manage");
    const supabase = ctx.supabase;

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
  } catch (e) {
    return authzErrorResponse(e);
  }
}
