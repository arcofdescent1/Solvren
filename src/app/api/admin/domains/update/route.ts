import { NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

type Body =
  | {
      type: "UPSERT_DOMAIN";
      key: string;
      name: string;
      description?: string | null;
      isActive: boolean;
    }
  | {
      type: "UPSERT_SLA";
      domainKey: string;
      policyKey: string;
      dueHours: number;
      dueSoonHours: number;
      escalationHours: number;
    }
  | {
      type: "UPSERT_SIGNAL";
      domainKey: string;
      signalKey: string;
      name: string;
      description?: string | null;
      severity: string;
      defaultWeight: number;
      detector: Record<string, unknown>;
    }
  | {
      type: "UPSERT_MITIGATION";
      domainKey: string;
      signalKey: string;
      mitigationKey: string;
      recommendation: string;
      severity: string;
    }
  | { type: "DELETE_SIGNAL"; domainKey: string; signalKey: string }
  | {
      type: "DELETE_MITIGATION";
      domainKey: string;
      signalKey: string;
      mitigationKey: string;
    };

export async function POST(req: Request) {
  try {
    const ctx = await requireAnyOrgPermission("domains.manage");
    const supabase = ctx.supabase;

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
      if (body.type === "UPSERT_DOMAIN") {
        const { key, name, description, isActive } = body;
        const { error } = await supabase.from("domains").upsert(
          { key, name, description: description ?? null, is_active: isActive },
          { onConflict: "key" }
        );
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }

      if (body.type === "UPSERT_SLA") {
        const {
          domainKey,
          policyKey,
          dueHours,
          dueSoonHours,
          escalationHours,
        } = body;
        const { error } = await supabase
          .from("domain_sla_policies")
          .upsert(
            {
              domain_key: domainKey,
              policy_key: policyKey,
              due_hours: Math.max(1, Math.min(720, Math.floor(dueHours))),
              due_soon_hours: Math.max(1, Math.min(240, Math.floor(dueSoonHours))),
              escalation_hours: Math.max(
                1,
                Math.min(720, Math.floor(escalationHours))
              ),
            },
            { onConflict: "domain_key,policy_key" }
          );
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }

      if (body.type === "UPSERT_SIGNAL") {
        const {
          domainKey,
          signalKey,
          name,
          description,
          severity,
          defaultWeight,
          detector,
        } = body;
        const w = Math.max(0.3, Math.min(3.0, Number(defaultWeight)));
        const { error } = await supabase.from("domain_signals").upsert(
          {
            domain_key: domainKey,
            signal_key: signalKey,
            name,
            description: description ?? null,
            severity,
            default_weight: w,
            detector: detector ?? {},
          },
          { onConflict: "domain_key,signal_key" }
        );
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }

      if (body.type === "UPSERT_MITIGATION") {
        const {
          domainKey,
          signalKey,
          mitigationKey,
          recommendation,
          severity,
        } = body;
        const { error } = await supabase
          .from("domain_signal_mitigations")
          .upsert(
            {
              domain_key: domainKey,
              signal_key: signalKey,
              mitigation_key: mitigationKey,
              recommendation,
              severity,
            },
            { onConflict: "domain_key,signal_key,mitigation_key" }
          );
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }

      if (body.type === "DELETE_SIGNAL") {
        const { domainKey, signalKey } = body;
        await supabase
          .from("domain_signal_mitigations")
          .delete()
          .eq("domain_key", domainKey)
          .eq("signal_key", signalKey);
        const { error } = await supabase
          .from("domain_signals")
          .delete()
          .eq("domain_key", domainKey)
          .eq("signal_key", signalKey);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }

      if (body.type === "DELETE_MITIGATION") {
        const { domainKey, signalKey, mitigationKey } = body;
        const { error } = await supabase
          .from("domain_signal_mitigations")
          .delete()
          .eq("domain_key", domainKey)
          .eq("signal_key", signalKey)
          .eq("mitigation_key", mitigationKey);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json(
        { error: "Unknown update type" },
        { status: 400 }
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    return authzErrorResponse(e);
  }
}
