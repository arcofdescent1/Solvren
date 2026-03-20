/**
 * Phase 2 — Canonical Data Model and Identity Graph (§9).
 * Shared enums and types for the identity module.
 */

export const CANONICAL_ENTITY_TYPES = [
  "person",
  "company",
  "opportunity",
  "subscription",
  "invoice",
  "payment",
  "meeting",
  "workflow",
  "change",
  "incident",
] as const;
export type CanonicalEntityType = (typeof CANONICAL_ENTITY_TYPES)[number];

export const CANONICAL_RELATIONSHIP_TYPES = [
  "belongs_to",
  "has_primary_contact",
  "has_billing_contact",
  "applies_to",
  "linked_to",
  "involves",
  "impacted",
  "caused_by",
  "affected",
  "touches",
] as const;
export type CanonicalRelationshipType = (typeof CANONICAL_RELATIONSHIP_TYPES)[number];

export const MATCH_STRATEGIES = [
  "deterministic_exact_email",
  "deterministic_external_reference",
  "deterministic_invoice_subscription_chain",
  "probabilistic_name_domain",
  "probabilistic_company_similarity",
  "manual_override",
  "backfill_import",
] as const;
export type MatchStrategy = (typeof MATCH_STRATEGIES)[number];

export const LINK_STATUSES = ["linked", "unlinked"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export const MATCH_CANDIDATE_REVIEW_STATUSES = ["pending", "accepted", "rejected"] as const;
export type MatchCandidateReviewStatus = (typeof MATCH_CANDIDATE_REVIEW_STATUSES)[number];

export const ENTITY_ATTRIBUTE_KEYS = [
  "normalized_email",
  "full_name",
  "job_title",
  "phone",
  "company_domain",
  "owner_id",
  "lifecycle_stage",
  "company_name",
  "website_domain",
  "employee_band",
  "arr_band",
  "region",
  "segment",
  "stage",
  "amount",
  "close_date",
  "forecast_category",
  "plan",
  "mrr",
  "billing_cadence",
  "amount_due",
  "due_date",
  "failure_reason",
  "recoverability_hint",
  "meeting_time",
  "outcome",
  "organizer",
  "booking_source",
] as const;
export type EntityAttributeKey = (typeof ENTITY_ATTRIBUTE_KEYS)[number];

export type ResolutionOutcome =
  | "existing_link"
  | "auto_linked"
  | "created_entity"
  | "candidate_created"
  | "unresolved";

export interface ResolveExternalObjectInput {
  orgId: string;
  provider: string;
  objectType: string;
  externalId: string;
  payload: Record<string, unknown>;
  integrationAccountId?: string | null;
  observedAt: string;
}

export interface ResolveExternalObjectResult {
  canonicalEntityId: string | null;
  entityType: CanonicalEntityType;
  resolutionOutcome: ResolutionOutcome;
  confidenceScore: number;
  reasons: string[];
}
