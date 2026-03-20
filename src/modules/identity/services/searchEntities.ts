/**
 * Phase 2 — Search canonical entities (§17.1). By display name, canonical key, external ID.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalEntityType } from "../types";
import { listCanonicalEntities } from "../repositories/canonicalEntityRepository";
import { listCanonicalEntityIdsByExternalIdSearch } from "../repositories/entityLinkRepository";
import { getCanonicalEntityById } from "../repositories/canonicalEntityRepository";

export type SearchEntitiesParams = {
  orgId: string;
  q?: string;
  entityType?: CanonicalEntityType | string;
  status?: string;
  limit?: number;
  offset?: number;
};

export type SearchEntitiesResult = {
  data: Awaited<ReturnType<typeof listCanonicalEntities>>["data"];
  error: Error | null;
};

/** Search by display_name, canonical_key, and linked external_id. */
export async function searchEntities(
  supabase: SupabaseClient,
  params: SearchEntitiesParams
): Promise<SearchEntitiesResult> {
  const limit = Math.min(100, params.limit ?? 20);
  const offset = params.offset ?? 0;

  const { data: byNameAndKey, error: e1 } = await listCanonicalEntities(supabase, {
    orgId: params.orgId,
    entityType: params.entityType,
    status: params.status,
    q: params.q,
    limit: limit + 50,
    offset: 0,
  });
  if (e1) return { data: [], error: e1 };

  const byId = new Map(byNameAndKey.map((e) => [e.id, e]));

  if (params.q?.trim()) {
    const { data: linkEntityIds } = await listCanonicalEntityIdsByExternalIdSearch(
      supabase,
      params.orgId,
      params.q,
      limit
    );
    for (const id of linkEntityIds) {
      if (byId.has(id)) continue;
      const { data: entity } = await getCanonicalEntityById(supabase, id);
      if (entity && (!params.entityType || entity.entity_type === params.entityType) && (!params.status || entity.status === params.status))
        byId.set(id, entity);
    }
  }

  const merged = [...byId.values()];
  merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const paginated = merged.slice(offset, offset + limit);
  return { data: paginated, error: null };
}
