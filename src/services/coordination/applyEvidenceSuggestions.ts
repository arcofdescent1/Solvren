import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoordinationPlan } from "./coordinationTypes";

export async function applyEvidenceSuggestions(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  plan: CoordinationPlan;
}) {
  const evidence = [
    ...args.plan.evidence.requiredItems.map((e) => ({
      kind: e.kind,
      label: e.title,
      severity: "REQUIRED",
    })),
    ...args.plan.evidence.recommendedItems.map((e) => ({
      kind: e.kind,
      label: e.title,
      severity: "RECOMMENDED",
    })),
  ];

  const { data: existing, error: exErr } = await args.supabase
    .from("change_evidence_items")
    .select("id, kind")
    .eq("change_event_id", args.changeId);
  if (exErr) throw new Error(exErr.message);

  const byKind = new Map((existing ?? []).map((e) => [String(e.kind), String(e.id)]));
  const inserts = evidence.filter((e) => !byKind.has(e.kind));

  if (inserts.length > 0) {
    const { error: insErr } = await args.supabase.from("change_evidence_items").insert(
      inserts.map((e) => ({
        change_event_id: args.changeId,
        org_id: args.orgId,
        kind: e.kind,
        label: e.label,
        severity: e.severity,
        status: "MISSING",
      }))
    );
    if (insErr) throw new Error(insErr.message);
  }

  return { inserted: inserts.length };
}
