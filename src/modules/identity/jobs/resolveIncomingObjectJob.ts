/**
 * Phase 2 — Resolve one incoming provider object (§13).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveExternalObject } from "../services/entityResolutionService";
import type { ResolveExternalObjectInput, ResolveExternalObjectResult } from "../types";

export type ResolveIncomingObjectJobInput = ResolveExternalObjectInput;

export async function runResolveIncomingObjectJob(
  supabase: SupabaseClient,
  input: ResolveIncomingObjectJobInput
): Promise<ResolveExternalObjectResult> {
  return resolveExternalObject(supabase, input);
}
