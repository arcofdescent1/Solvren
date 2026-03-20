/**
 * Phase 2 — Probabilistic matching (§10.3). Review candidates only; never auto-link.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalEntityType, MatchStrategy } from "../types";
import { listCanonicalEntities } from "../repositories/canonicalEntityRepository";
import { normalizeDomain, domainFromEmail, extractDomain, extractFullName } from "./normalizationService";

export type ProbabilisticCandidate = {
  canonicalEntityId: string;
  entityType: CanonicalEntityType;
  confidence: number;
  strategy: MatchStrategy;
  reasons: string[];
};

/** Simple token-set similarity: Jaccard on word tokens (lowercase). Returns 0..1. */
function nameSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 0)
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Person: first+last+domain, or full name similarity + company overlap. */
export async function findProbabilisticPersonCandidates(
  supabase: SupabaseClient,
  orgId: string,
  payload: Record<string, unknown>
): Promise<ProbabilisticCandidate[]> {
  const email = (payload.email ?? payload.primary_email ?? (payload.properties as Record<string, unknown>)?.email) as string | undefined;
  const domain = email ? domainFromEmail(email) : extractDomain(payload);
  const fullName = extractFullName(payload);
  const normDomain = domain ? normalizeDomain(domain) : null;
  if (!normDomain && !fullName) return [];

  const { data: entities } = await listCanonicalEntities(supabase, {
    orgId,
    entityType: "person",
    status: "active",
    limit: 200,
  });
  const candidates: ProbabilisticCandidate[] = [];

  for (const e of entities) {
    const pref = (e.preferred_attributes_json ?? {}) as Record<string, unknown>;
    const entityEmail = (pref.normalized_email ?? pref.email) as string | undefined;
    const entityDomain = entityEmail ? domainFromEmail(entityEmail) : (pref.company_domain as string | undefined);
    const entityNormDomain = entityDomain ? normalizeDomain(entityDomain) : null;
    const entityName = (pref.full_name ?? pref.name) as string | undefined;

    const reasons: string[] = [];
    let score = 0;

    if (normDomain && entityNormDomain && normDomain === entityNormDomain) {
      score += 0.5;
      reasons.push("Matching domain");
    }
    if (fullName && entityName) {
      const sim = nameSimilarity(fullName, entityName);
      if (sim >= 0.6) {
        score += Math.min(0.5, sim * 0.6);
        reasons.push(`Name similarity ${(sim * 100).toFixed(0)}%`);
      }
    }

    if (score >= 0.85 && reasons.length > 0) {
      candidates.push({
        canonicalEntityId: e.id,
        entityType: "person",
        confidence: Math.min(0.97, score),
        strategy: "probabilistic_name_domain",
        reasons,
      });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/** Company: normalized name similarity, domain match, or linked-people overlap. */
export async function findProbabilisticCompanyCandidates(
  supabase: SupabaseClient,
  orgId: string,
  payload: Record<string, unknown>
): Promise<ProbabilisticCandidate[]> {
  const companyName = (payload.name ?? payload.company_name ?? payload.properties?.name) as string | undefined;
  const domain = (payload.domain ?? payload.website ?? payload.properties?.domain) as string | undefined;
  const normDomain = domain ? normalizeDomain(domain) : null;
  const normName = companyName
    ? String(companyName)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
    : "";

  if (!normDomain && !normName) return [];

  const { data: entities } = await listCanonicalEntities(supabase, {
    orgId,
    entityType: "company",
    status: "active",
    limit: 200,
  });
  const candidates: ProbabilisticCandidate[] = [];

  for (const e of entities) {
    const pref = (e.preferred_attributes_json ?? {}) as Record<string, unknown>;
    const entityName = (pref.company_name ?? pref.name ?? e.display_name) as string | undefined;
    const entityNormName = entityName
      ? String(entityName)
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim()
      : "";
    const entityDomain = (pref.website_domain ?? pref.domain) as string | undefined;
    const entityNormDomain = entityDomain ? normalizeDomain(entityDomain) : null;

    const reasons: string[] = [];
    let score = 0;

    if (normDomain && entityNormDomain && normDomain === entityNormDomain) {
      score += 0.7;
      reasons.push("Matching domain");
    }
    if (normName && entityNormName) {
      const sim = nameSimilarity(normName, entityNormName);
      if (sim >= 0.7) {
        score += Math.min(0.4, sim * 0.5);
        reasons.push(`Company name similarity ${(sim * 100).toFixed(0)}%`);
      }
    }

    if (score >= 0.85 && reasons.length > 0) {
      candidates.push({
        canonicalEntityId: e.id,
        entityType: "company",
        confidence: Math.min(0.97, score),
        strategy: "probabilistic_company_similarity",
        reasons,
      });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/** Entry: return best probabilistic candidates for the given entity type and payload. */
export async function findProbabilisticCandidates(
  supabase: SupabaseClient,
  orgId: string,
  entityType: CanonicalEntityType,
  payload: Record<string, unknown>
): Promise<ProbabilisticCandidate[]> {
  if (entityType === "person") return findProbabilisticPersonCandidates(supabase, orgId, payload);
  if (entityType === "company") return findProbabilisticCompanyCandidates(supabase, orgId, payload);
  return [];
}
