/**
 * Phase 2 — Canonical Data Model and Identity Graph.
 */
export * from "./types";
export * from "./constants";
export * from "./repositories";
export { resolveExternalObject } from "./services/entityResolutionService";
export { reviewMatchCandidate } from "./services/reviewQueueService";
export { mergeEntities } from "./services/entityMergeService";
export { splitEntity } from "./services/entitySplitService";
export { unlinkExternalObject } from "./services/unlinkService";
export { normalizeEmail, normalizeDomain, domainFromEmail, extractPrimaryEmail, extractDomain, extractFullName } from "./services/normalizationService";
export { findProbabilisticCandidates } from "./services/probabilisticMatcher";
export { ensureCanonicalRelationship, rebuildRelationshipsForOrg } from "./services/relationshipResolver";
export { getEffectiveThresholds, getResolutionRules } from "./services/resolutionRulesService";
export { searchEntities } from "./services/searchEntities";
export { getIdentityMetrics, evaluateIdentityAlerts } from "./metrics/identityMetrics";
export { runResolveIncomingObjectJob } from "./jobs/resolveIncomingObjectJob";
export { runRecomputePreferredAttributesJob } from "./jobs/recomputePreferredAttributesJob";
export { runRebuildRelationshipsJob } from "./jobs/rebuildRelationshipsJob";
export { runStaleCandidateSweepJob } from "./jobs/staleCandidateSweepJob";
export { backfillInternal, backfillChanges, backfillIncidents } from "./backfill/backfillInternal";
export { resolvePreferredAttributes } from "./services/attributeResolver";
