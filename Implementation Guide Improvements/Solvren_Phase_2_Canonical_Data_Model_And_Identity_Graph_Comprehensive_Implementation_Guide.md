# Solvren — Phase 2 Comprehensive Implementation Guide
## Canonical Data Model and Identity Graph

Version: 1.0  
Audience: Product, Engineering, Architecture, Data, QA  
Purpose: Establish the canonical business object model and identity graph required for Solvren to correlate signals across systems, detect cross-system revenue-impacting issues, quantify impact accurately, and support closed-loop remediation and verification.

---

# 1. Executive Summary

Solvren’s North Star is to identify, prioritize, and resolve revenue-impacting risks and inefficiencies across fragmented business systems before they cause loss, then prove the issue was actually fixed. The master context defines Solvren as a closed-loop system that detects issues, quantifies impact, prioritizes action, routes ownership, tracks resolution, and verifies outcomes across systems such as CRM, payments, scheduling, marketing automation, data warehouses, and internal tools. fileciteturn0file0L5-L24 fileciteturn0file0L25-L38

Phase 1 made integrations first-class and standardized connector health, sync, webhook, and action patterns. Phase 2 is the layer that makes those integrations truly valuable. Without a canonical data model and identity graph, Solvren cannot confidently determine that a HubSpot contact, Salesforce lead, Stripe customer, meeting invitee, internal app user, and Jira ticket all refer to the same underlying customer, account, opportunity, or revenue event.

This phase solves that problem by introducing:

- Canonical entities that represent the business objects Solvren reasons about
- Entity links that connect external provider records to those canonical entities
- Match rules and confidence scoring for deterministic and probabilistic resolution
- Review workflows for ambiguous matches
- APIs, jobs, UIs, and audit trails that make entity correlation transparent and correctable
- Standards for how later phases use canonical entities for signals, detectors, impact models, routing, and verification

This document is intended to be comprehensive enough for product and engineering to implement with minimal ambiguity.

---

# 2. Why Phase 2 Exists

## 2.1 Problem Statement

Solvren integrates with multiple systems that each use different identifiers, schemas, and object models:

- CRM systems store contacts, companies, leads, deals, opportunities, owners, and activities
- Payment systems store customers, subscriptions, invoices, charges, payment intents, and disputes
- Scheduling tools store meetings, bookings, organizers, invitees, and outcomes
- Internal product databases store accounts, users, plans, orders, and lifecycle state
- Ticketing and collaboration tools store issues, tasks, threads, and approvals

If these records remain siloed, Solvren can only detect narrow, provider-local issues. That creates four major failures:

1. Cross-system breakage is invisible  
   Example: A lead exists in the CRM, never gets booked in scheduling, later appears as churn risk in billing.

2. Impact quantification is weak  
   Example: A failed payment is worth more if it belongs to a strategic account, linked opportunity, or high-LTV subscription.

3. Routing is incomplete  
   Example: Ownership may live in Salesforce, but the action belongs in Jira and the business context belongs in HubSpot.

4. Verification is brittle  
   Example: Solvren cannot prove a fix worked if it cannot compare the before and after state for the same real-world entity across systems.

## 2.2 Desired Outcome

After Phase 2, Solvren must be able to:

- Represent core business objects once in a canonical model
- Link all relevant external records to the correct canonical entities
- Explain why a match exists and how confident it is
- Route uncertain matches into review queues
- Let detectors and impact models operate on canonical entities instead of raw provider objects
- Preserve full auditability for all entity creation, linking, merge, split, and override actions

---

# 3. Product Requirements

## 3.1 Product Goals

Phase 2 must enable the following product outcomes:

1. Solvren can correlate records from different systems into one business narrative.
2. Users can trust what Solvren believes is “the same customer,” “the same company,” or “the same opportunity.”
3. Product surfaces can explain linked records clearly in issue detail pages.
4. Admins can inspect and fix identity mistakes without engineering intervention.
5. Phase 3 signal ingestion, Phase 4 detectors, and Phase 5 impact modeling can all consume canonical entity IDs.

## 3.2 Non-Goals

This phase does **not** aim to:

- Build a general-purpose customer data platform
- Replace upstream CRMs as source-of-record systems
- Auto-merge all records without human review
- Support every entity type in the business on day one

The phase focuses on the minimum viable canonical model required to power Solvren’s highest-value revenue protection use cases.

---

# 4. Canonical Data Model Overview

## 4.1 Architectural Principle

Provider objects are not Solvren’s truth. Canonical entities are Solvren’s operating truth.

Solvren does not replace source systems. Instead, it creates a correlation layer that maps source-system records into a stable internal model for reasoning, detection, prioritization, routing, and verification.

## 4.2 Core Concepts

### External Object
A provider-native record, such as:
- HubSpot contact
- Salesforce account
- Stripe customer
- Chili Piper meeting
- Jira issue

### Canonical Entity
A Solvren-native representation of a real-world business object, such as:
- Person
- Company
- Opportunity
- Subscription
- Invoice
- Payment
- Meeting
- Change
- Incident

### Entity Link
A typed, auditable connection between an external object and a canonical entity.

### Match Candidate
A proposed correlation between one or more external objects and a canonical entity, awaiting auto-accept or manual review.

### Canonical Relationship
A relationship between two canonical entities, such as:
- Person belongs to Company
- Opportunity belongs to Company
- Subscription belongs to Company
- Invoice belongs to Subscription
- Meeting linked to Opportunity
- Change impacted Subscription

---

# 5. Canonical Entity Types — Initial Scope

The initial release must support the following canonical entity types.

## 5.1 Person
Represents an individual buyer, customer, lead, contact, champion, or user.

Typical inputs:
- HubSpot contact
- Salesforce contact / lead
- Stripe customer contact metadata
- meeting invitee
- internal user

Key business use cases:
- unworked lead
- duplicate contact risk
- missing follow-up
- ownerless lifecycle stage change

## 5.2 Company
Represents an account, business, employer, or customer organization.

Typical inputs:
- HubSpot company
- Salesforce account
- internal account or organization
- Stripe customer with company metadata/domain

Key business use cases:
- enterprise account risk
- account ownership drift
- company-level revenue exposure
- routing by account segment

## 5.3 Opportunity
Represents a pipeline-bearing sales motion.

Typical inputs:
- HubSpot deal
- Salesforce opportunity
- internal quote or pipeline object

Key business use cases:
- stage stall
- attribution gaps
- meeting-to-pipeline conversion failures
- revenue-at-risk by opportunity

## 5.4 Subscription
Represents a recurring commercial agreement or active billing relationship.

Typical inputs:
- Stripe subscription
- NetSuite subscription or contract surrogate
- internal subscription model

Key business use cases:
- failed payment recovery
- churn risk
- MRR at risk
- payment behavior by segment

## 5.5 Invoice
Represents a billable receivable.

Typical inputs:
- Stripe invoice
- NetSuite invoice
- internal receivable object

Key business use cases:
- overdue revenue
- collection issues
- invoice failure patterns

## 5.6 Payment
Represents a transaction attempt or settlement object.

Typical inputs:
- Stripe charge/payment intent
- NetSuite payment record

Key business use cases:
- failed payment spikes
- recoverability analysis
- payment failure incident linkage

## 5.7 Meeting
Represents a scheduled or completed buyer interaction.

Typical inputs:
- Chili Piper booking
- OnceHub booking
- calendar-derived surrogate where supported later

Key business use cases:
- MQL with no meeting
- no-show follow-up failure
- meeting conversion gaps

## 5.8 Workflow
Represents an operational automation or integration workflow.

Typical inputs:
- internal automation
- future Zapier/HubSpot workflow objects
- sync job abstractions

Key business use cases:
- broken workflow drift
- failed automation root cause tracing

## 5.9 Change
Represents a governed business or technical change.

Typical inputs:
- Solvren change request
- deployment event mapped later

Key business use cases:
- change-induced incident
- revenue-impacting changes
- readiness and evidence correlations

## 5.10 Incident
Represents an operational incident or outcome event.

Typical inputs:
- Solvren incident
- future imported incident records

Key business use cases:
- issue verification
- impact rollups
- change correlation

---

# 6. Canonical Relationships — Initial Scope

These relationships must be supported in the first implementation:

- Person `belongs_to` Company
- Opportunity `belongs_to` Company
- Opportunity `has_primary_contact` Person
- Subscription `belongs_to` Company
- Subscription `has_billing_contact` Person
- Invoice `belongs_to` Subscription
- Invoice `belongs_to` Company
- Payment `applies_to` Invoice
- Meeting `linked_to` Opportunity
- Meeting `involves` Person
- Change `impacted` Company
- Change `impacted` Subscription
- Incident `affected` Company
- Incident `caused_by` Change
- Workflow `touches` Opportunity
- Workflow `touches` Subscription

These relationships must be modeled explicitly, not only inferred ad hoc in code.

---

# 7. Source of Truth Strategy

## 7.1 Principle

Solvren is not the source of record for core business entities. Upstream systems remain authoritative for their provider-native records.

Solvren is the source of truth for:

- canonical correlation state
- link confidence and rationale
- match review decisions
- canonical relationship graph
- derived business context used for detection and impact models

## 7.2 Conflict Strategy

When upstream systems disagree, Solvren must not silently invent certainty. Instead it must:

- preserve conflicting values with provenance
- choose an effective “preferred value” for downstream logic using configurable precedence rules
- record why that value was selected
- surface low-confidence or conflicting identity states for review where necessary

Example precedence for `company_domain`:
1. Salesforce account website/domain if present and validated
2. HubSpot company domain if present and validated
3. Stripe customer metadata domain if present
4. Derived domain from dominant linked person email if business email

Preferred-value selection must be deterministic and auditable.

---

# 8. Data Model — Database Schema

The exact naming can be adjusted to current migration patterns, but the following tables and fields are required.

## 8.1 `canonical_entities`

Purpose: store Solvren-native business objects.

Fields:
- `id` UUID PK
- `org_id` UUID not null
- `entity_type` text not null
- `display_name` text null
- `canonical_key` text null
- `preferred_attributes_json` jsonb not null default '{}'
- `source_summary_json` jsonb not null default '{}'
- `status` text not null default 'active'
- `merge_parent_id` UUID null
- `created_by_type` text not null default 'system'
- `created_by_ref` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- `archived_at` timestamptz null

Constraints and indexes:
- index on `(org_id, entity_type)`
- unique partial index on `(org_id, entity_type, canonical_key)` where canonical_key is not null
- index on `(org_id, status)`

Notes:
- `canonical_key` is optional and should only be populated when a stable internal key exists
- `preferred_attributes_json` stores resolved operating values such as normalized email, website domain, account tier, MRR band, etc.
- `source_summary_json` stores lightweight lineage metadata used by the UI

## 8.2 `entity_links`

Purpose: map external provider objects to canonical entities.

Fields:
- `id` UUID PK
- `org_id` UUID not null
- `canonical_entity_id` UUID not null FK
- `provider` text not null
- `integration_account_id` UUID null FK
- `external_object_type` text not null
- `external_id` text not null
- `external_key` text null
- `link_status` text not null default 'linked'
- `confidence_score` numeric(5,4) not null
- `match_strategy` text not null
- `match_reasons_json` jsonb not null default '[]'
- `linked_by_type` text not null default 'system'
- `linked_by_ref` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- `unlinked_at` timestamptz null

Constraints and indexes:
- unique index on `(org_id, provider, external_object_type, external_id)` where link_status = 'linked'
- index on `(canonical_entity_id)`
- index on `(org_id, provider, external_object_type)`
- index on `(org_id, confidence_score)`

## 8.3 `canonical_relationships`

Purpose: store typed graph edges between canonical entities.

Fields:
- `id` UUID PK
- `org_id` UUID not null
- `from_entity_id` UUID not null FK
- `relationship_type` text not null
- `to_entity_id` UUID not null FK
- `directionality` text not null default 'directed'
- `confidence_score` numeric(5,4) not null default 1.0000
- `source_type` text not null
- `source_ref` text null
- `relationship_attributes_json` jsonb not null default '{}'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- `ended_at` timestamptz null

Constraints and indexes:
- index on `(org_id, from_entity_id)`
- index on `(org_id, to_entity_id)`
- index on `(org_id, relationship_type)`
- unique partial index on `(org_id, from_entity_id, relationship_type, to_entity_id)` where ended_at is null

## 8.4 `entity_match_candidates`

Purpose: store ambiguous proposed matches before acceptance.

Fields:
- `id` UUID PK
- `org_id` UUID not null
- `candidate_type` text not null
- `primary_provider` text not null
- `primary_object_type` text not null
- `primary_external_id` text not null
- `proposed_entity_type` text not null
- `proposed_canonical_entity_id` UUID null FK
- `confidence_score` numeric(5,4) not null
- `score_breakdown_json` jsonb not null default '{}'
- `reasons_json` jsonb not null default '[]'
- `review_status` text not null default 'pending'
- `reviewed_by` UUID null
- `reviewed_at` timestamptz null
- `review_notes` text null
- `created_at` timestamptz not null default now()
- `expires_at` timestamptz null

Indexes:
- index on `(org_id, review_status)`
- index on `(org_id, confidence_score)`
- index on `(org_id, proposed_entity_type)`

## 8.5 `entity_attribute_values`

Purpose: preserve multi-source values and provenance for important attributes.

Fields:
- `id` UUID PK
- `org_id` UUID not null
- `canonical_entity_id` UUID not null FK
- `attribute_key` text not null
- `attribute_value_json` jsonb not null
- `provider` text not null
- `external_object_type` text not null
- `external_id` text not null
- `is_preferred` boolean not null default false
- `precedence_rank` integer not null
- `confidence_score` numeric(5,4) not null default 1.0000
- `observed_at` timestamptz not null
- `created_at` timestamptz not null default now()

Indexes:
- index on `(canonical_entity_id, attribute_key)`
- index on `(org_id, attribute_key, is_preferred)`

## 8.6 `entity_resolution_events`

Purpose: audit all identity actions.

Fields:
- `id` UUID PK
- `org_id` UUID not null
- `event_type` text not null
- `canonical_entity_id` UUID null
- `related_entity_id` UUID null
- `link_id` UUID null
- `candidate_id` UUID null
- `actor_type` text not null
- `actor_ref` text null
- `event_payload_json` jsonb not null default '{}'
- `created_at` timestamptz not null default now()

Indexes:
- index on `(org_id, event_type)`
- index on `(canonical_entity_id)`
- index on `(created_at)`

## 8.7 Optional helper table: `entity_resolution_rules`

Purpose: store org-specific matching rules or overrides.

Fields:
- `id` UUID PK
- `org_id` UUID not null
- `entity_type` text not null
- `rule_key` text not null
- `enabled` boolean not null default true
- `config_json` jsonb not null default '{}'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

This table is recommended if per-org tuning will be supported early.

---

# 9. Type Definitions — Engineering Contract

Engineering must define shared TypeScript types under `src/modules/identity/types.ts`.

Required enums/types:

- `CanonicalEntityType`
- `CanonicalRelationshipType`
- `MatchStrategy`
- `LinkStatus`
- `MatchCandidateReviewStatus`
- `EntityAttributeKey`

Example `CanonicalEntityType` values:
- `person`
- `company`
- `opportunity`
- `subscription`
- `invoice`
- `payment`
- `meeting`
- `workflow`
- `change`
- `incident`

Example `MatchStrategy` values:
- `deterministic_exact_email`
- `deterministic_external_reference`
- `deterministic_invoice_subscription_chain`
- `probabilistic_name_domain`
- `probabilistic_company_similarity`
- `manual_override`
- `backfill_import`

The codebase must use these shared enums rather than string literals spread across jobs and handlers.

---

# 10. Matching and Resolution Strategy

## 10.1 Resolution Pipeline

Every new or updated provider object that is relevant to Phase 2 must pass through the identity resolution pipeline.

Pipeline steps:

1. Normalize object fields  
   Standardize email, domain, name, phone, currency, timestamps, and object-type-specific keys.

2. Determine target canonical entity type  
   Example: HubSpot contact → person, Stripe invoice → invoice.

3. Check for deterministic link opportunities  
   Example: exact email match to existing person, same external reference key, same provider/external ID already linked.

4. Compute probabilistic candidates if no deterministic match found  
   Example: fuzzy company name plus matching domain plus linked person overlap.

5. Apply thresholds  
   - high-confidence auto-link  
   - medium-confidence queue for review  
   - low-confidence create new canonical entity or leave unresolved depending on object class

6. Write outcome  
   - create entity
   - create link
   - create candidate
   - update preferred attributes
   - emit audit event

## 10.2 Deterministic Matching Rules — First-Class

The following rules must be implemented first because they are explainable and safe.

### Person
- Exact normalized primary email match
- Exact provider-foreign-key carried from CRM to internal system
- Meeting invitee email to existing person email

### Company
- Exact normalized domain match when domain is corporate and valid
- Exact known CRM account ID reference carried into downstream systems
- Exact billing account mapping from internal system

### Opportunity
- Same provider ID already linked
- Exact external quote/order reference if present
- Explicit CRM cross-reference field present in connected systems

### Subscription
- Exact Stripe subscription ID
- Exact internal billing subscription external reference

### Invoice
- Exact invoice ID from billing system
- Exact parent subscription chain where invoice external reference known

### Payment
- Exact payment intent / charge ID
- exact invoice/payment chain from provider metadata

### Meeting
- Exact scheduler booking ID
- meeting linked by provider opportunity/deal ID metadata
- exact invitee email plus start-time match when provider IDs unavailable

### Change and Incident
- Existing Solvren internal IDs only

## 10.3 Probabilistic Matching Rules — Initial Scope

Use only when deterministic rules fail or to propose review candidates.

### Person
- first name + last name + domain
- full name similarity + linked company overlap
- alternate email/domain alias rules

### Company
- normalized company name similarity
- domain similarity and redirect normalization
- linked people overlap across domains/subsidiaries

### Opportunity
- deal name similarity + company match + close-date proximity
- subscription/account lineage match

Probabilistic matching must never auto-link unless confidence exceeds a very conservative threshold and reasons are explainable.

## 10.4 Thresholds

Initial thresholds:
- `>= 0.98` auto-link for deterministic or near-certain cases
- `0.85 - 0.9799` create review candidate
- `< 0.85` create new entity or remain unresolved according to object policy

These thresholds should live in config, not code constants.

## 10.5 Object Policies

Not all objects should behave the same when unresolved.

Recommended initial policies:

- Person: create new canonical entity if no strong match
- Company: create new canonical entity if no strong match, but emit duplicate risk if close alternative exists
- Opportunity: create new canonical entity if provider-local record is legitimate and unique
- Subscription/Invoice/Payment: create new canonical entity when exact provider record is new
- Meeting: if meeting cannot be linked to person or opportunity, still create meeting entity but flag low-context state
- Workflow: create only when sourced from supported internal workflow objects in Phase 3+

---

# 11. Preferred Attribute Resolution

## 11.1 Why It Matters

A canonical entity may have multiple values for the same attribute from different sources. Solvren needs one “preferred” operating value for downstream use while preserving source lineage.

## 11.2 Initial Preferred Attributes

### Person
- normalized email
- full name
- job title
- phone
- company domain
- owner id
- lifecycle stage

### Company
- company name
- website/domain
- employee band
- ARR band / account tier
- owner id
- region
- segment

### Opportunity
- stage
- amount
- close date
- owner id
- forecast category

### Subscription
- plan
- MRR
- billing cadence
- status
- owner/account manager

### Invoice
- amount_due
- due_date
- status

### Payment
- amount
- status
- failure reason
- recoverability hint

### Meeting
- meeting time
- outcome
- organizer
- booking source

## 11.3 Preferred Attribute Rules

Each attribute must support a precedence policy:

- provider precedence list
- freshness weighting
- confidence weighting
- validation status

Example:
`person.normalized_email`
- prefer CRM primary email if valid
- else scheduler invitee email if valid
- else billing contact email if valid

These rules must be implemented in a single resolver layer, not scattered in ETL code.

---

# 12. Canonical Relationship Resolution

## 12.1 Relationship Creation Sources

Relationships can be created from:
- provider-native references
- explicit Solvren actions
- deterministic inference rules
- reviewed candidate approvals

## 12.2 Required Relationship Rules

Examples:

- If a HubSpot contact is associated to a company and both are linked canonically, create `person belongs_to company`
- If a Salesforce opportunity belongs to an account, create `opportunity belongs_to company`
- If a Stripe invoice belongs to a subscription, create `invoice belongs_to subscription`
- If a scheduler booking includes a CRM deal reference, create `meeting linked_to opportunity`
- If a Solvren change explicitly marks impacted accounts, create `change impacted company`

## 12.3 Relationship Confidence

Relationships sourced from explicit provider references can default high confidence.
Relationships inferred from soft logic must store lower confidence and may require review if business critical.

---

# 13. Module and File Structure

Create a new module:

`src/modules/identity/`

Recommended structure:

- `index.ts`
- `types.ts`
- `constants.ts`
- `repositories/`
  - `canonicalEntityRepository.ts`
  - `entityLinkRepository.ts`
  - `relationshipRepository.ts`
  - `matchCandidateRepository.ts`
  - `attributeValueRepository.ts`
  - `resolutionEventRepository.ts`
- `services/`
  - `normalizationService.ts`
  - `entityResolutionService.ts`
  - `deterministicMatcher.ts`
  - `probabilisticMatcher.ts`
  - `attributeResolver.ts`
  - `relationshipResolver.ts`
  - `entityMergeService.ts`
  - `entitySplitService.ts`
  - `reviewQueueService.ts`
- `jobs/`
  - `resolveIncomingObjectJob.ts`
  - `recomputePreferredAttributesJob.ts`
  - `rebuildRelationshipsJob.ts`
  - `staleCandidateSweepJob.ts`
- `api/`
  - `getEntity.ts`
  - `searchEntities.ts`
  - `listMatchCandidates.ts`
  - `reviewMatchCandidate.ts`
  - `mergeEntities.ts`
  - `splitEntity.ts`
  - `unlinkExternalObject.ts`
- `ui/`
  - `EntityProfileCard.tsx`
  - `EntityLinksTable.tsx`
  - `EntityRelationshipsGraph.tsx`
  - `IdentityReviewQueue.tsx`
  - `MatchCandidateReviewPanel.tsx`
  - `EntityMergeDialog.tsx`
  - `EntitySplitDialog.tsx`

All provider-specific mapping logic should live in Phase 1 integration or Phase 3 signal mappers, but they must call into this identity module rather than inventing their own link state.

---

# 14. API Contracts

These routes should be implemented under the app’s existing API conventions.

## 14.1 `GET /api/identity/entities/:id`

Returns:
- canonical entity core data
- preferred attributes
- linked external records
- related canonical entities
- resolution history summary

## 14.2 `GET /api/identity/entities/search`

Query params:
- `entityType`
- `q`
- `provider`
- `linkedOnly`
- `status`

Returns paginated canonical entities.

## 14.3 `GET /api/identity/match-candidates`

Query params:
- `entityType`
- `reviewStatus`
- `provider`
- `minConfidence`

Returns pending and reviewed candidates.

## 14.4 `POST /api/identity/match-candidates/:id/review`

Body:
- `decision`: `accept_existing` | `create_new` | `reject`
- `canonicalEntityId` optional
- `notes` optional

Behavior:
- updates candidate
- creates/links entity as needed
- records audit event
- recomputes preferred attributes and relationships

## 14.5 `POST /api/identity/entities/merge`

Body:
- `sourceEntityIds[]`
- `targetEntityId`
- `mergePolicy`
- `notes`

Behavior:
- moves active links to target
- ends or rewrites relationships
- archives merged entities
- writes merge audit event

## 14.6 `POST /api/identity/entities/:id/split`

Body:
- `linkIdsToMove[]`
- `newEntityAttributes`
- `notes`

Behavior:
- creates new canonical entity
- moves selected links
- recomputes attributes/relationships for both entities
- writes split audit event

## 14.7 `POST /api/identity/links/:id/unlink`

Body:
- `reason`

Behavior:
- sets link inactive/unlinked
- may create candidate or low-confidence alert
- writes audit event

## 14.8 Internal service contract

There must also be an internal method used by integrations/jobs:

`resolveExternalObject({ orgId, provider, objectType, externalId, payload, integrationAccountId, observedAt })`

Return contract:
- `canonicalEntityId`
- `entityType`
- `resolutionOutcome` (`existing_link`, `auto_linked`, `created_entity`, `candidate_created`, `unresolved`)
- `confidenceScore`
- `reasons[]`

This method becomes the standard entry point for all future ingestion work.

---

# 15. UI / UX Requirements

## 15.1 Identity Review Queue

Create an admin page under Settings or Data Quality:

`/app/[org]/admin/identity`

Tabs:
- Pending Review
- Recently Resolved
- Duplicate Risks
- Merge History

Required columns:
- object type
- provider
- proposed entity type
- confidence
- top reasons
- created at
- review CTA

Review panel must show:
- raw external record summary
- candidate canonical entity summary
- side-by-side attribute comparison
- reason breakdown
- accept/create/reject actions

## 15.2 Canonical Entity Detail View

Create page:

`/app/[org]/identity/[entityId]`

Sections:
- entity summary and preferred attributes
- linked source records by provider
- relationships graph / related entities
- recent issues involving this entity
- recent resolution events
- merge/split controls for privileged users

## 15.3 Issue Detail Integration

In the issue detail page from Phase 0, replace raw provider references with:
- affected canonical entities
- linked external records
- confidence indicator
- quick open to entity page

## 15.4 Integration Control Center Linkage

From the Phase 1 Integration Control Center, provide a link to see:
- how many provider objects are linked
- how many are unresolved
- how many duplicate risks exist
- average match confidence by object type

---

# 16. RBAC and Permissions

Identity operations are sensitive. Implement RBAC controls.

Suggested permissions:
- `identity.read`
- `identity.review`
- `identity.merge`
- `identity.split`
- `identity.unlink`
- `identity.admin`

Recommended defaults:
- Org admins: all
- Ops admins / platform admins: read + review + merge + split + unlink
- standard users: read only where entity appears within issue context, no admin actions

All mutating actions must write audit records and appear in org audit logs.

---

# 17. Search and Observability

## 17.1 Search

Canonical entities must be searchable by:
- display name
- email
- domain
- company name
- provider external ID
- canonical key

Search index or materialized search fields should be added if current repo patterns support it.

## 17.2 Metrics

Track at minimum:
- number of canonical entities by type
- number of active links by provider/object type
- auto-link rate
- candidate review volume
- acceptance vs rejection rate
- mean candidate review age
- merge count
- split count
- unresolved object count
- average confidence score
- attribute conflict count

## 17.3 Alerts

Alert internally when:
- unresolved object volume spikes
- candidate backlog grows above threshold
- match confidence degrades for a provider
- merge/split failures occur

---

# 18. Backfill and Migration Plan

## 18.1 Migration Goal

Existing integrated objects and internal change/incident records must be backfilled into the canonical model without breaking current product behavior.

## 18.2 Migration Sequence

### Step 1 — schema migrations
Add all new tables, indexes, enums, and audit support.

### Step 2 — seed canonical entity types and relationship constants
No customer-visible change yet.

### Step 3 — backfill internal Solvren-native objects
Backfill:
- existing organizations if needed as company entities only where product requires
- existing changes into canonical `change`
- existing incidents into canonical `incident`

These should be high confidence because IDs are internal.

### Step 4 — backfill Tier 1 provider objects
Backfill in this order:
1. HubSpot contacts and companies
2. Salesforce leads/contacts/accounts/opportunities
3. Stripe customers/subscriptions/invoices/payments
4. Scheduling meetings

### Step 5 — relationship backfill
Create relationships after links are in place.

### Step 6 — attribute preference computation
Populate preferred attributes after links and relationships settle.

### Step 7 — candidate queue generation
Any ambiguous or low-confidence matches become review items.

## 18.3 Safety Rules

- All backfill jobs must be idempotent
- Keep dry-run mode first
- Persist score breakdowns for later QA
- Do not auto-merge borderline company matches on first run
- Record exact migration batch IDs in audit events

---

# 19. QA and Test Plan

## 19.1 Unit Tests

Required for:
- normalization logic
- deterministic matching logic
- probabilistic scoring logic
- threshold policy behavior
- attribute preference resolution
- relationship generation
- merge and split services

## 19.2 Integration Tests

Required for:
- resolving incoming provider objects end to end
- reviewing a match candidate
- merging duplicate companies
- splitting mistaken person merges
- issue detail loading canonical entity context

## 19.3 Backfill Tests

Run fixture-based backfill datasets covering:
- duplicate contacts across HubSpot and Salesforce
- same company with domain variants
- Stripe customer with no CRM match
- opportunity linked to account and primary contact
- meeting with invitee email but missing deal reference

## 19.4 Manual QA Scenarios

Product and QA should validate:
- a user can inspect why two records matched
- a user can safely reject a bad candidate
- a user can merge duplicates and see the graph update
- issue detail pages show canonical entities correctly
- no current change/incident workflows regress

---

# 20. Acceptance Criteria / Definition of Done

Phase 2 is complete when all of the following are true:

1. Solvren has a production-ready canonical entity model for the initial scoped entity types.
2. Tier 1 provider objects can be resolved into canonical entities through a standard service.
3. Entity links are auditable and confidence-scored.
4. Deterministic matching rules are implemented and covered by tests.
5. Probabilistic candidate generation exists for the initial ambiguous cases.
6. Admin users have a working identity review queue.
7. Canonical entity detail pages exist and show links, relationships, and history.
8. Issue detail pages can display canonical entity context instead of raw-only provider references.
9. Merge and split workflows exist with audit coverage.
10. Backfill runs successfully on seeded environments without corrupting existing data.
11. Metrics and logs exist for observability of resolution quality.
12. The implementation is documented well enough for Phase 3 signal ingestion to consume canonical entity IDs as a stable dependency.

---

# 21. Risks and Mitigations

## Risk 1: Over-aggressive auto-linking creates silent data corruption
Mitigation:
- conservative thresholds
- deterministic-first strategy
- candidate queue for ambiguity
- merge/split tools and audits

## Risk 2: Company matching is much harder than person matching
Mitigation:
- domain-first approach
- no automatic fuzzy merge unless confidence very high
- explicit duplicate-risk queue

## Risk 3: Too much scope in initial entity types
Mitigation:
- focus on the listed entity types only
- defer niche objects until detector requirements demand them

## Risk 4: Existing product surfaces still depend on provider-native objects
Mitigation:
- bridge issue detail pages first
- keep provider-native views where needed during migration
- add adapter methods rather than big-bang rewrites

## Risk 5: Performance issues on large org datasets
Mitigation:
- proper indexes
- batched backfills
- async candidate generation where necessary
- cache/materialize hot search fields

---

# 22. Implementation Sequence Recommendation

## Sprint A
- schema migrations
- shared types and repositories
- normalization service
- deterministic matcher for person/company

## Sprint B
- entity resolution service
- link creation
- preferred attribute resolver
- canonical relationships for person/company/opportunity

## Sprint C
- candidate review queue UI
- entity detail page
- merge/split services and APIs

## Sprint D
- Tier 1 provider backfills
- issue detail integration
- metrics, audit, and admin polish

---

# 23. Handoff Notes for Product

Product should make the following explicit in copy and training materials:

- Solvren does not claim perfect auto-identity on day one
- Solvren provides explainable correlation with reviewable confidence
- canonical entities are the foundation for better detection, better revenue impact estimates, and better verification
- admins have tools to correct and improve identity quality over time

Product should also define initial success metrics:
- auto-link rate by provider/object type
- false-link rate from reviewed samples
- candidate backlog SLA
- issue coverage using canonical entity IDs

---

# 24. Handoff Notes for Engineering

Engineering must preserve these invariants:

- all identity actions are auditable
- all provider ingestion uses the shared identity resolution entry point
- all thresholds and precedence rules are configurable
- all low-confidence business-critical correlations are reviewable
- canonical entities are stable IDs for downstream systems, even if preferred attributes change over time

Do not allow provider-specific shortcuts that bypass the identity module.

---

# 25. What Phase 3 Will Depend On

Phase 3 signal ingestion will assume:
- provider objects can resolve to canonical entities when appropriate
- signals can carry `canonical_entity_id`
- relationship lookups are available for cross-entity detector logic
- preferred attributes can be referenced in issue titles, impact summaries, and routing rules

If Phase 2 is implemented correctly, Phase 3 becomes substantially simpler and more reliable.

---

# 26. Final Summary

Phase 2 is the correlation layer that turns a set of integrations into an operational intelligence platform. It is the difference between “we connected several tools” and “we can actually understand what is breaking across the revenue engine.”

Once implemented, Solvren will be able to reason about customers, companies, opportunities, subscriptions, invoices, payments, meetings, changes, and incidents as stable business entities, regardless of where the raw records originated. That is a foundational requirement for delivering on the North Star of detecting, quantifying, prioritizing, routing, resolving, and verifying revenue-impacting issues across fragmented systems. fileciteturn0file0L25-L38 fileciteturn0file0L83-L95
