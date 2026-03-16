import type { SupabaseClient } from "@supabase/supabase-js";
import { getMitigationsForSignals } from "@/services/domains/mitigations";

export type Mitigation = {
  signalKey: string;
  recommendation: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  metadata?: Record<string, unknown>;
};

// Map legacy severity (LOW|MED|HIGH) to CRITICAL
function normalizeSeverity(s: string | null | undefined): Mitigation["severity"] {
  const u = String(s ?? "MEDIUM").toUpperCase();
  if (u === "CRITICAL") return "CRITICAL";
  if (u === "HIGH") return "HIGH";
  if (u === "LOW") return "LOW";
  if (u === "MED") return "MEDIUM";
  return "MEDIUM";
}

// Domain-scoped (domain_signal_mitigations) first; then org-scoped/global (signal_mitigations).
export async function fetchMitigationsForSignals(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    domain?: string;
    signalKeys: string[];
  }
): Promise<Mitigation[]> {
  const { orgId, domain = "REVENUE", signalKeys } = args;
  const uniqKeys = Array.from(new Set(signalKeys)).filter(Boolean);
  if (uniqKeys.length === 0) return [];

  const domainVal = domain ?? "REVENUE";

  try {
    const domainMitigations = await getMitigationsForSignals(supabase, {
      domainKey: domainVal,
      signalKeys: uniqKeys,
    });
    if (domainMitigations.length > 0) {
      return domainMitigations.map((r) => ({
        signalKey: r.signal_key,
        recommendation: String(r.recommendation ?? ""),
        severity: normalizeSeverity(r.severity),
        metadata: {} as Record<string, unknown>,
      }));
    }
  } catch {
    // Fall through to signal_mitigations
  }

  let data: Record<string, unknown>[] | null = null;
  let err: { message?: string } | null = null;

  const cols = "signal_key, recommendation, severity, severity_enum, metadata";
  const { data: rows1, error: e1 } = await supabase
    .from("signal_mitigations")
    .select(cols)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .or(`domain.eq.${domainVal},domain.is.null`)
    .in("signal_key", uniqKeys);

  if (!e1 && rows1?.length) {
    data = rows1 as Record<string, unknown>[];
  } else {
    const { data: rows2, error: e2 } = await supabase
      .from("signal_mitigations")
      .select("signal_key, recommendation, severity, evidence_kind")
      .or(`domain.eq.${domainVal},domain.is.null`)
      .in("signal_key", uniqKeys);
    if (!e2 && rows2?.length) data = rows2 as Record<string, unknown>[];
    err = e2;
  }

  if (err || !data?.length) return [];

  return data.map((r: Record<string, unknown>) => ({
    signalKey: String(r.signal_key ?? ""),
    recommendation: String(r.recommendation ?? ""),
    severity: r.severity_enum
      ? (String(r.severity_enum) as Mitigation["severity"])
      : normalizeSeverity(r.severity as string),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }));
}
