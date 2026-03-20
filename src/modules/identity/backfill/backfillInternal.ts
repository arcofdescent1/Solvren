/**
 * Phase 2 — Backfill internal Solvren objects into canonical model (§18.2 Step 3).
 * Idempotent: existing links are reused.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveExternalObject } from "../services/entityResolutionService";

export type BackfillInternalResult = {
  change: { processed: number; linked: number; created: number; errors: number };
  incident: { processed: number; linked: number; created: number; errors: number };
};

export async function backfillChanges(
  supabase: SupabaseClient,
  orgId: string,
  options: { dryRun?: boolean; limit?: number } = {}
): Promise<{ processed: number; linked: number; created: number; errors: number }> {
  const limit = options.limit ?? 500;
  const { data: rows } = await supabase
    .from("change_events")
    .select("id, org_id, title, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  const list = rows ?? [];
  let linked = 0;
  let created = 0;
  let errors = 0;

  if (options.dryRun) return { processed: list.length, linked: 0, created: 0, errors: 0 };

  for (const row of list) {
    const r = row as { id: string; org_id: string; title: string | null; updated_at: string };
    const result = await resolveExternalObject(supabase, {
      orgId,
      provider: "internal",
      objectType: "change",
      externalId: r.id,
      payload: { title: r.title ?? r.id, id: r.id },
      observedAt: r.updated_at ?? new Date().toISOString(),
    });
    if (result.resolutionOutcome === "existing_link" || result.resolutionOutcome === "auto_linked") linked++;
    else if (result.resolutionOutcome === "created_entity") created++;
    else errors++;
  }
  return { processed: list.length, linked, created, errors };
}

export async function backfillIncidents(
  supabase: SupabaseClient,
  orgId: string,
  options: { dryRun?: boolean; limit?: number } = {}
): Promise<{ processed: number; linked: number; created: number; errors: number }> {
  const limit = options.limit ?? 500;
  const { data: rows } = await supabase
    .from("incidents")
    .select("id, org_id, description, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const list = rows ?? [];
  let linked = 0;
  let created = 0;
  let errors = 0;

  if (options.dryRun) return { processed: list.length, linked: 0, created: 0, errors: 0 };

  for (const row of list) {
    const r = row as { id: string; org_id: string; description: string | null; created_at: string };
    const result = await resolveExternalObject(supabase, {
      orgId,
      provider: "internal",
      objectType: "incident",
      externalId: r.id,
      payload: { title: r.description ?? r.id, id: r.id },
      observedAt: r.created_at ?? new Date().toISOString(),
    });
    if (result.resolutionOutcome === "existing_link" || result.resolutionOutcome === "auto_linked") linked++;
    else if (result.resolutionOutcome === "created_entity") created++;
    else errors++;
  }
  return { processed: list.length, linked, created, errors };
}

export async function backfillInternal(
  supabase: SupabaseClient,
  orgId: string,
  options: { dryRun?: boolean; limit?: number } = {}
): Promise<BackfillInternalResult> {
  const change = await backfillChanges(supabase, orgId, options);
  const incident = await backfillIncidents(supabase, orgId, options);
  return { change, incident };
}
