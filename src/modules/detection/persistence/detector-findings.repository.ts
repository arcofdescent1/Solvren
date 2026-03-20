/**
 * Phase 4 — detector_findings repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DetectorFindingRow = {
  id: string;
  org_id: string;
  detector_definition_id: string;
  detector_run_id: string;
  grouping_key: string;
  dedupe_key: string;
  finding_status: string;
  primary_canonical_entity_id: string | null;
  severity: string;
  priority_band: string;
  confidence_score: number;
  evidence_bundle_json: Record<string, unknown>;
  suppression_reason_json: Record<string, unknown> | null;
  issue_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function insertDetectorFinding(
  supabase: SupabaseClient,
  input: Omit<DetectorFindingRow, "id" | "created_at" | "updated_at">
): Promise<{ data: DetectorFindingRow | null; error: Error | null }> {
  const row = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("detector_findings")
    .upsert(row, { onConflict: "org_id,detector_definition_id,dedupe_key", ignoreDuplicates: false })
    .select()
    .single();
  return { data: data as DetectorFindingRow | null, error: error as Error | null };
}

export async function getDetectorFindingById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: DetectorFindingRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("detector_findings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as DetectorFindingRow | null, error: error as Error | null };
}

export async function updateDetectorFinding(
  supabase: SupabaseClient,
  id: string,
  updates: { finding_status?: string; issue_id?: string | null }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("detector_findings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}

export async function listDetectorFindings(
  supabase: SupabaseClient,
  params: { orgId: string; detectorDefinitionId?: string; findingStatus?: string; limit?: number }
): Promise<{ data: DetectorFindingRow[]; error: Error | null }> {
  let q = supabase
    .from("detector_findings")
    .select("*")
    .eq("org_id", params.orgId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);
  if (params.detectorDefinitionId) q = q.eq("detector_definition_id", params.detectorDefinitionId);
  if (params.findingStatus) q = q.eq("finding_status", params.findingStatus);
  const { data, error } = await q;
  return { data: (data ?? []) as DetectorFindingRow[], error: error as Error | null };
}
