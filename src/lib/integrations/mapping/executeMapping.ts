/**
 * Phase 1 — Mapping executor.
 * RAW PAYLOAD → MAPPING ENGINE → CANONICAL OBJECT
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalObjectType } from "../canonicalSchema";
import { resolvePath } from "./pathResolver";
import { applyTransformChain } from "./transformEngine";
import { validateCanonical } from "./validateCanonical";
import type { ExecuteMappingResult, MappingConfig, MappingFieldRule } from "./types";
import type { TransformSpec } from "./transformEngine";

/**
 * Execute mapping with inline config (for testing without persisting).
 */
export function executeMappingWithConfig(
  config: MappingConfig,
  payload: unknown
): Omit<ExecuteMappingResult, "runId"> {
  const canonical: Record<string, unknown> = {};
  const warnings: string[] = [];

  for (const rule of config.fields) {
    const value = applyFieldRule(payload, rule);
    if (value !== undefined) {
      canonical[rule.canonical_field] = value;
    }
  }

  const validation = validateCanonical(
    config.canonical_object_type as CanonicalObjectType,
    canonical
  );

  return {
    status: validation.status === "failed" ? "failed" : validation.status === "warning" ? "warning" : "success",
    canonical: Object.keys(canonical).length > 0 ? canonical : null,
    errors: validation.errors,
    warnings: [...warnings, ...validation.warnings],
  };
}

export type ExecuteMappingInput = {
  orgId: string;
  providerKey: string;
  sourceObjectType: string;
  mappingVersion?: number;
  payload: unknown;
  supabase: SupabaseClient;
  persistRun?: boolean;
};

export async function executeMapping(input: ExecuteMappingInput): Promise<ExecuteMappingResult> {
  const { orgId, providerKey, sourceObjectType, mappingVersion, payload, supabase, persistRun } = input;
  const config = await loadActiveMapping(supabase, orgId, providerKey, sourceObjectType, mappingVersion);
  if (!config) {
    return {
      status: "failed",
      canonical: null,
      errors: [`No active mapping found for ${providerKey}/${sourceObjectType}`],
      warnings: [],
    };
  }

  const canonical: Record<string, unknown> = {};
  const warnings: string[] = [];

  for (const rule of config.fields) {
    const value = applyFieldRule(payload, rule);
    if (value !== undefined) {
      canonical[rule.canonical_field] = value;
    }
  }

  const validation = validateCanonical(
    config.canonical_object_type as CanonicalObjectType,
    canonical
  );

  const result: ExecuteMappingResult = {
    status: validation.status === "failed" ? "failed" : validation.status === "warning" ? "warning" : "success",
    canonical: Object.keys(canonical).length > 0 ? canonical : null,
    errors: validation.errors,
    warnings: [...warnings, ...validation.warnings],
  };

  if (persistRun) {
    try {
      const { data } = await supabase
        .from("integration_mapping_runs")
        .insert({
          mapping_id: config.id,
          org_id: orgId,
          input_payload: payload,
          output_payload: result.canonical,
          errors: result.errors.length > 0 ? result.errors : null,
          status: result.status,
        })
        .select("id")
        .single();
      if (data && typeof data === "object" && "id" in data) result.runId = data.id as string;
    } catch {
      // Non-fatal: run persisted for audit
    }
  }

  return result;
}

async function loadActiveMapping(
  supabase: SupabaseClient,
  orgId: string,
  providerKey: string,
  sourceObjectType: string,
  mappingVersion?: number
): Promise<MappingConfig | null> {
  let q = supabase
    .from("integration_mappings")
    .select("id, org_id, provider_key, source_object_type, canonical_object_type, version")
    .eq("org_id", orgId)
    .eq("provider_key", providerKey)
    .eq("source_object_type", sourceObjectType)
    .eq("is_active", true);

  if (mappingVersion != null) {
    q = q.eq("version", mappingVersion);
  }

  const { data: mapping, error } = await q.maybeSingle();
  if (error || !mapping) return null;

  const { data: fieldRows } = await supabase
    .from("integration_mapping_fields")
    .select("source_path, canonical_field, transform_chain, default_value")
    .eq("mapping_id", (mapping as { id: string }).id);

  const fields: MappingFieldRule[] = (fieldRows ?? []).map((r) => ({
    source_path: (r as { source_path: string }).source_path,
    canonical_field: (r as { canonical_field: string }).canonical_field,
    transform_chain: ((r as { transform_chain: unknown }).transform_chain as TransformSpec[]) ?? [],
    default_value: (r as { default_value: string | null }).default_value ?? null,
  }));

  return {
    id: (mapping as { id: string }).id,
    org_id: (mapping as { org_id: string }).org_id,
    provider_key: (mapping as { provider_key: string }).provider_key,
    source_object_type: (mapping as { source_object_type: string }).source_object_type,
    canonical_object_type: (mapping as { canonical_object_type: string }).canonical_object_type,
    version: (mapping as { version: number }).version,
    fields,
  };
}

function applyFieldRule(payload: unknown, rule: MappingFieldRule): unknown {
  let value = resolvePath(payload, rule.source_path);
  if (value === undefined || value === null) {
    value = rule.default_value ?? null;
  }
  if (value === null || value === undefined) return undefined;
  const transformed = applyTransformChain(value, rule.transform_chain);
  if (transformed === null || transformed === undefined) return undefined;
  return transformed;
}
