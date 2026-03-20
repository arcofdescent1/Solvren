# Solvren — Phase 5 Comprehensive Implementation Guide
## Impact Quantification Engine

Version: 1.0  
Status: Implementation-ready  
Audience: Product, Engineering, Data, Finance/RevOps, QA, Security, Customer Success  
Prerequisites:
- Phase 0 complete: canonical issue model, lifecycle, module boundaries
- Phase 1 complete: integration platform and connector contracts
- Phase 2 complete: canonical data model and identity graph
- Phase 3 complete: raw event ingestion, normalization, replay, signal quality, signal registry
- Phase 4 complete: detector framework, findings, issue creation contract, first detector packs

---

# 1. Executive Purpose

Phase 5 gives Solvren economic credibility.

Phases 1–4 enable Solvren to connect systems, normalize activity, detect operational failures, and create issues with explainable evidence. But detection alone is not enough for executive trust or budget justification. Solvren’s North Star requires the platform to answer not just what is breaking, but what is it costing us, what should we fix first, and what value did we protect or recover.

Phase 5 creates the Impact Quantification Engine that assigns economically meaningful, explainable, auditable impact estimates to issues and findings.

By the end of Phase 5, Solvren must be able to:
- estimate direct realized loss, revenue at risk, and operational cost for issues
- score confidence in those estimates
- explain the assumptions used
- support multiple impact models by issue family
- version impact logic over time
- separate observed loss from inferred risk
- expose impact to dashboards, prioritization, routing, and executive reporting
- support later verification by comparing estimated impact against realized outcomes

This is the phase that converts Solvren from “problem detection software” into “revenue protection software.”

---

# 2. Product Objective

## 2.1 Product statement

Solvren must quantify the business impact of detected issues using explicit, auditable, model-based estimates that combine available signals, entity context, customer configuration, and historical business assumptions.

## 2.2 Commercial outcome

After Phase 5, Solvren can support category-defining value statements such as:
- this failed payment represents $2,400 of recoverable revenue at risk
- these stalled opportunities represent $180,000 of pipeline at risk
- this lead-response failure pattern likely costs 14 meetings per month
- this sync-drift problem threatens attribution accuracy across $1.2M in pipeline reporting
- these unsafe changes are concentrated around surfaces responsible for 38% of online conversion

That matters because buyers justify spend through economic outcomes, not issue counts.

## 2.3 User-visible outcome

After Phase 5:
- each issue displays impact cards and assumptions
- findings can be prioritized by dollar impact, customer count, or operational cost
- executive dashboards show open risk, realized loss, avoided loss, and recovered value
- users can understand both estimate magnitude and confidence level
- product and customer success teams can defend the platform’s prioritization logic

---

# 3. Scope

## 3.1 In scope

Phase 5 includes:
- impact model architecture
- issue impact schema
- impact model registry and versioning
- model execution engine
- confidence scoring
- assumptions capture
- issue impact summaries
- executive and operator impact dashboards
- baseline impact models for first detector packs
- prioritization inputs
- APIs, UI, and observability
- replay/recalculation support

## 3.2 Out of scope

Phase 5 does not include:
- final closed-loop verification of realized impact after remediation
- autonomous pricing/billing tied to recovered value
- customer-authored arbitrary formulas in UI
- ML-only black-box impact estimates
- finance-grade GAAP accounting outputs

Those may come later, but Phase 5 must still be strong enough to drive prioritization and executive trust.

---

# 4. Product Principles

1. **Impact must be separated into distinct concepts**  
   Solvren must not conflate realized loss, revenue at risk, avoided loss, recovered value, and operational cost.

2. **Every impact estimate must be explainable**  
   A user must be able to inspect which model ran, which inputs were used, and which assumptions were applied.

3. **Confidence is mandatory**  
   Every impact output must include a confidence score and explanation.

4. **Observed facts outrank inferred estimates**  
   If actual invoice amount is known, use it. If only historical averages are available, label the estimate accordingly.

5. **Impact models are versioned artifacts**  
   Model changes will happen and must be traceable.

6. **Impact should be actionable, not academically perfect**  
   The goal is prioritization and decision support, not exhaustive financial accounting.

7. **Org-specific assumptions must be supported**  
   Conversion rates, average deal size, recovery rate, and labor cost vary by customer.

8. **Model gaps must be visible**  
   If Solvren cannot estimate impact well, it must say so rather than projecting false precision.

---

# 5. Core Domain Concepts

## 5.1 Impact Assessment

A structured, versioned estimate of the business impact associated with a finding or issue.

## 5.2 Impact Model

A versioned model that calculates one or more impact outputs for a given issue type, finding type, or detector family.

## 5.3 Direct Realized Loss

Known or near-certain loss already incurred.
Example:
- invoice amount on an unpaid invoice that has definitively failed and been canceled
- refund amount already issued
- known downtime loss if directly measured

## 5.4 Revenue at Risk

Potential revenue likely to be lost if the issue is not resolved.
Example:
- a failed payment still recoverable through dunning
- a stalled opportunity that may decay
- unworked qualified leads likely to miss conversion windows

## 5.5 Avoided Loss

Estimated loss prevented by timely action. This becomes more important when Phase 7 verification exists, but the model contract starts here.

## 5.6 Recovered Value

Revenue or value recovered after intervention. This may initially be a placeholder field populated later by verification or closed-loop workflows.

## 5.7 Operational Cost

Estimated labor/time cost or process cost imposed by the issue.
Example:
- manual duplicate cleanup effort
- triage and routing burden
- support labor due to sync conflicts

## 5.8 Confidence Score

A 0–100 rating indicating the trustworthiness of the impact estimate based on evidence quality, directness of measures, identity certainty, model fit, and assumptions.

## 5.9 Assumption Set

The configuration values and default business assumptions used by the impact model.
Examples:
- average deal size
- MQL-to-opportunity conversion rate
- meeting-to-opportunity conversion rate
- payment recovery probability
- average loaded labor cost per hour

---

# 6. Reference Architecture

Impact pipeline:

1. a detector finding becomes actionable or an issue is created/updated
2. Impact Engine selects the appropriate impact model based on issue family, detector key, and available signals
3. required inputs are assembled:
   - normalized signals
   - canonical entities
   - detector evidence bundle
   - org assumptions
   - historical baseline metrics where available
4. model evaluates direct loss, at-risk value, operational cost, and confidence
5. impact assessment is persisted as a versioned artifact
6. issue is updated with current impact summary
7. prioritization engine consumes the summary
8. dashboards and reporting surfaces expose the result
9. if inputs change materially, impact can be recalculated

Impact must support both:
- **on-create computation** for immediate issue scoring
- **recalculation workflows** when issue context, assumptions, or model versions change

---

# 7. Required Module Structure

Create under `src/modules/impact/`:

```text
src/modules/impact/
  domain/
    impact-assessment.ts
    impact-model.ts
    impact-summary.ts
    confidence-score.ts
    assumption-set.ts
    impact-breakdown.ts
  registry/
    impact-model-registry.ts
    seed-impact-models.ts
    seed-default-assumptions.ts
  engine/
    impact-engine.service.ts
    impact-input-assembler.service.ts
    confidence-scorer.service.ts
    impact-recalculator.service.ts
    issue-impact-sync.service.ts
  models/
    base/
      impact-model.interface.ts
      impact-model-context.ts
      impact-model-result.ts
    revenue-leakage/
    funnel/
    data-integrity/
    change-risk/
  persistence/
    impact-models.repository.ts
    impact-assessments.repository.ts
    org-impact-assumptions.repository.ts
    impact-recalculation-jobs.repository.ts
  jobs/
    recalculate-impact-for-issue.job.ts
    backfill-impact-assessments.job.ts
    recalculate-after-assumption-change.job.ts
  api/
    admin/
      impact-models.route.ts
      impact-assessments.route.ts
      impact-assumptions.route.ts
    issues/
      issue-impact.route.ts
  ui/
    IssueImpactCard.tsx
    ImpactBreakdownPanel.tsx
    ImpactAssumptionsDrawer.tsx
    ImpactModelAdminPage.tsx
    OrgImpactAssumptionsPage.tsx
    ExecutiveImpactDashboard.tsx
```

---

# 8. Database Schema

## 8.1 `impact_models`

Purpose: registry of versioned impact models.

Columns:
- `id` UUID PK
- `model_key` text not null
- `display_name` text not null
- `issue_family` text not null
- `detector_keys_json` jsonb not null default `[]`
- `description` text not null
- `inputs_schema_json` jsonb not null
- `outputs_schema_json` jsonb not null
- `assumptions_schema_json` jsonb not null
- `confidence_rules_json` jsonb not null
- `status` text not null default `draft`
- `model_version` text not null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Unique:
- `(model_key, model_version)`

## 8.2 `org_impact_assumptions`

Purpose: customer-specific assumptions used by impact models.

Columns:
- `id` UUID PK
- `org_id` UUID not null
- `assumption_key` text not null
- `display_name` text not null
- `value_json` jsonb not null
- `value_type` text not null
- `source` text not null
  - `default`, `org_override`, `derived`, `imported`
- `effective_from` timestamptz not null default now()
- `effective_to` timestamptz nullable
- `confidence_score` numeric(5,2) nullable
- `notes` text nullable
- `updated_by_user_id` UUID nullable
- `created_at` timestamptz not null default now()

Indexes:
- `(org_id, assumption_key, effective_from desc)`

## 8.3 `impact_assessments`

Purpose: persisted impact results for issues and findings.

Columns:
- `id` UUID PK
- `org_id` UUID not null
- `issue_id` UUID nullable
- `finding_id` UUID nullable
- `impact_model_id` UUID not null references `impact_models(id)`
- `model_key` text not null
- `model_version` text not null
- `assessment_status` text not null
  - `estimated`, `recalculated`, `superseded`, `insufficient_data`
- `direct_realized_loss_amount` numeric(18,2) nullable
- `revenue_at_risk_amount` numeric(18,2) nullable
- `avoided_loss_amount` numeric(18,2) nullable
- `recovered_value_amount` numeric(18,2) nullable
- `operational_cost_amount` numeric(18,2) nullable
- `affected_customer_count` integer nullable
- `affected_record_count` integer nullable
- `confidence_score` numeric(5,2) not null
- `impact_score` numeric(5,2) not null
- `currency_code` text not null default 'USD'
- `inputs_snapshot_json` jsonb not null
- `assumptions_snapshot_json` jsonb not null
- `calculation_breakdown_json` jsonb not null
- `confidence_explanation_json` jsonb not null
- `created_at` timestamptz not null default now()
- `superseded_by_assessment_id` UUID nullable

Indexes:
- `(org_id, issue_id, created_at desc)`
- `(org_id, finding_id, created_at desc)`

## 8.4 `issue_impact_summaries`

Purpose: current rolled-up impact state used by issue views and prioritization.

Columns:
- `issue_id` UUID PK references `issues(id)`
- `org_id` UUID not null
- `latest_assessment_id` UUID not null references `impact_assessments(id)`
- `current_direct_realized_loss_amount` numeric(18,2) nullable
- `current_revenue_at_risk_amount` numeric(18,2) nullable
- `current_avoided_loss_amount` numeric(18,2) nullable
- `current_recovered_value_amount` numeric(18,2) nullable
- `current_operational_cost_amount` numeric(18,2) nullable
- `current_confidence_score` numeric(5,2) not null
- `current_impact_score` numeric(5,2) not null
- `currency_code` text not null default 'USD'
- `last_calculated_at` timestamptz not null
- `last_model_key` text not null
- `last_model_version` text not null

## 8.5 `impact_recalculation_jobs`

Purpose: queue and audit recalculation requests.

Columns:
- `id` UUID PK
- `org_id` UUID not null
- `scope_type` text not null
  - `issue`, `finding`, `model_key`, `org_all`
- `scope_ref_json` jsonb not null
- `reason` text not null
- `requested_by_user_id` UUID nullable
- `status` text not null default `queued`
- `started_at` timestamptz nullable
- `completed_at` timestamptz nullable
- `results_json` jsonb nullable
- `created_at` timestamptz not null default now()

---

# 9. Impact Model Contract

Every impact model must define:
- `model_key`
- `display_name`
- `issue_family`
- `supported_detector_keys[]`
- `required_inputs[]`
- `optional_inputs[]`
- `required_assumptions[]`
- `outputs[]`
- `confidence_rules`
- `fallback_rules`
- `recalculation_triggers[]`
- `model_version`

Every implementation must accept:
- org context
- issue and/or finding context
- evidence bundle
- normalized signal references
- canonical entity references
- org assumptions
- historical metrics if available

Every implementation must return:
- direct realized loss
- revenue at risk
- operational cost
- optional avoided/recovered placeholders
- affected customer count
- affected record count
- confidence score
- impact score
- assumptions snapshot
- calculation breakdown
- confidence explanation

---

# 10. Impact Output Semantics

Impact Engine must keep the following concepts distinct:

## 10.1 Direct realized loss
Known already-incurred loss.
Examples:
- amount on definitively unpaid invoice
- known refunds issued
- known transaction failure value that was not recovered

## 10.2 Revenue at risk
Potential future loss if no remediation occurs.
Examples:
- qualified leads likely to go cold
- stalled deals with decaying win probability
- subscriptions at risk due to past-due state
- attribution failures that may distort downstream routing and conversion

## 10.3 Avoided loss
Estimated loss prevented through intervention. Typically populated later as remediation and verification mature.

## 10.4 Recovered value
Value regained after remediation or recovery. Initially may remain null for many issue types until later phases.

## 10.5 Operational cost
Expected internal labor or process overhead caused by the issue.

---

# 11. Confidence Model

Every impact assessment must carry a confidence score from 0–100.

Confidence should consider:
- signal quality from Phase 3
- entity linkage confidence from Phase 2
- directness of monetary inputs
- completeness of required assumptions
- freshness of supporting data
- whether estimates are based on org-specific or global defaults
- whether the model relies on strong historical data or weak proxies

Suggested confidence bands:
- 90–100: high confidence, direct financial evidence present
- 70–89: strong estimate with org-specific assumptions
- 50–69: moderate estimate with partial direct data
- 25–49: low confidence, proxy-heavy
- 0–24: insufficient confidence for strong prioritization

UI must display confidence bands, not just raw numbers.

---

# 12. Impact Score

In addition to raw dollar amounts, Solvren must compute a normalized `impact_score` from 0–100 used by prioritization.

The impact score may combine:
- direct realized loss magnitude
- revenue at risk magnitude
- customer count affected
- operational cost burden
- confidence score weighting
- strategic multiplier if configured later

Do not let confidence silently inflate magnitude. Low-confidence large estimates should still be surfaced but visibly discounted in prioritization.

Recommended formula concept:
- normalize economic values into bands
- combine weighted components
- multiply by confidence factor floor/ceiling policy

Store final score and full breakdown.

---

# 13. Assumptions Management

## 13.1 Required assumptions

Seed the following baseline assumptions:
- `avg_deal_size`
- `mql_to_opportunity_rate`
- `opportunity_to_close_rate`
- `meeting_to_opportunity_rate`
- `lead_response_decay_factor`
- `payment_recovery_rate`
- `avg_subscription_mrr`
- `avg_ltv_multiplier`
- `loaded_labor_cost_per_hour`
- `duplicate_cleanup_minutes_per_record`
- `critical_surface_revenue_share`

## 13.2 Assumption sources

Assumptions may come from:
- platform defaults
- org overrides entered by admin
- imported metrics from connected systems
- derived values calculated from observed history

Source must always be visible.

## 13.3 Assumption UX

Create `Admin > Impact Assumptions` page with:
- current value
- source
- confidence
- effective date
- where used
- override control with audit logging

Do not allow unsafe free-form formulas in Phase 5. Allow controlled value overrides only.

---

# 14. First Impact Models

## 14.1 Revenue Leakage Models

### Model RL1: Failed payment unrecovered
Applies to detectors:
- `revenue.failed_payment_unrecovered`

Required inputs:
- invoice amount if present
- subscription/customer refs
- failure time
- recovery status
- org payment recovery rate
- optional LTV multiplier

Outputs:
- `direct_realized_loss_amount`: null unless definitively lost
- `revenue_at_risk_amount`: invoice amount or modeled recovery-adjusted expected value
- `operational_cost_amount`: optional collections/ops burden
- affected customer count: 1

Calculation guidance:
- if invoice amount known, use invoice amount as baseline at-risk value
- if subscription recurring and recovery chance exists, model expected retained value using recovery probability
- if cancellation follows, move part/all value toward realized loss depending on timing and recoverability

### Model RL2: Past-due invoice high value
Applies to:
- `revenue.invoice_past_due_high_value`

Required inputs:
- invoice amount
- age past due
- customer segment if available
- historical recovery rate by age bucket if available

Outputs:
- direct realized loss usually null
- revenue at risk based on invoice amount × probability of non-recovery
- operational cost optional

### Model RL3: Subscription canceled after payment distress
Applies to:
- `revenue.subscription_canceled_after_failed_payment`

Required inputs:
- subscription MRR/ARR
- customer age or tenure if available
- org LTV multiplier
- cancellation signal
- payment distress timeline

Outputs:
- direct realized loss may include current missed invoice
- revenue at risk may include lost recurring value or retention-adjusted LTV
- affected customer count: 1

### Model RL4: Payment failure spike
Applies to:
- `revenue.payment_failure_spike`

Required inputs:
- count of failures
- total failed amount
- baseline failure rate
- time window

Outputs:
- org-level revenue at risk
- affected customer count
- aggregate operational burden

## 14.2 Funnel Protection Models

### Model FP1: Qualified lead unworked
Applies to:
- `funnel.qualified_lead_unworked`

Required inputs:
- lead score or tier if available
- lead qualification time
- owner/follow-up absence
- org MQL-to-opportunity rate
- org average opportunity value or deal size
- optional segment-specific conversion assumptions

Outputs:
- revenue at risk = estimated pipeline not created
- affected customer count usually 1
- operational cost low to moderate

Calculation guidance:
- if no lead score, use default qualified lead expected value
- if lead score/segment exists, map to expected opportunity value band
- discount value by elapsed time and response decay assumption

### Model FP2: Opportunity stalled in stage
Applies to:
- `funnel.opportunity_stalled_in_stage`

Required inputs:
- opportunity amount if known
- stage
- age in stage
- stage-specific win probability baseline
- decay factor for stage stalling

Outputs:
- revenue at risk = amount × probability erosion
- operational cost optional
- affected customer count may be 1 or more if grouped

### Model FP3: Meeting missing after qualification
Applies to:
- `funnel.meeting_missing_after_qualification`

Required inputs:
- qualified lead count or individual lead
- meeting-to-opportunity rate
- average opportunity value
- time since qualification

Outputs:
- revenue at risk based on expected opportunity value discounted by delay

### Model FP4: No-show without follow-up
Applies to:
- `funnel.no_show_without_followup`

Required inputs:
- no-show signal
- reschedule/follow-up absence
- meeting recovery rate assumption
- average expected pipeline per meeting

Outputs:
- revenue at risk based on lost reschedule or conversion chance

## 14.3 Data Integrity and Attribution Models

### Model DI1: Duplicate contact cluster
Applies to:
- `data.duplicate_contact_cluster`

Required inputs:
- duplicate count
- cluster size
- systems affected
- cleanup minutes per record
- loaded labor rate
- optional attribution distortion multiplier

Outputs:
- operational cost as primary output
- revenue at risk optional if duplicates affect active pipeline or attribution accuracy

### Model DI2: Opportunity missing source attribution
Applies to:
- `data.opportunity_missing_source_attribution`

Required inputs:
- opportunity amount or average pipeline value
- missing attribution fields
- age since creation
- attribution criticality policy

Outputs:
- operational cost for manual repair
- revenue at risk optional if routing/reporting impact is material

### Model DI3: Owner missing on revenue-critical records
Applies to:
- `data.owner_missing_revenue_record`

Required inputs:
- entity type
- record amount/value if available
- grace period breach
- response-delay risk factors

Outputs:
- revenue at risk if record is active pipeline or lead
- operational cost for triage

### Model DI4: Workflow sync drift detected
Applies to:
- `data.workflow_sync_drift_detected`

Required inputs:
- number of records affected
- fields impacted
- workflow criticality
- cleanup effort assumption
- optional revenue-surface criticality

Outputs:
- operational cost primary
- revenue at risk secondary if linked to active revenue workflows

## 14.4 Change Risk Models

### Model CR1: Revenue-impacting change missing approval
Applies to:
- `change.revenue_change_missing_approval`

Required inputs:
- change criticality
- affected systems/surfaces
- critical surface revenue share
- blast radius assumptions
- deployment state

Outputs:
- revenue at risk based on surface share × risk multiplier
- operational cost for incident prevention/triage

### Model CR2: High-risk change missing evidence
Applies to:
- `change.high_risk_change_missing_evidence`

Required inputs:
- change risk score
- missing evidence types
- affected system criticality
- historical incident propensity if available

Outputs:
- revenue at risk as prevention-oriented estimate
- operational cost for remediation/governance overhead

### Model CR3: Change followed by incident
Applies to:
- `change.change_followed_by_incident`

Required inputs:
- incident severity
- affected surface
- duration if known
- critical surface revenue share
- incident/customer count if available

Outputs:
- direct realized loss if measured or confidently inferable
- revenue at risk if incident is ongoing or unresolved
- operational cost high for triage burden

### Model CR4: Unsafe change concentration
Applies to:
- `change.unsafe_change_concentration`

Required inputs:
- count of risky changes
- time window
- critical surface revenue share
- historical failure rate

Outputs:
- preventive revenue at risk
- operational cost for compounded risk state

---

# 15. Impact Engine Workflow

## 15.1 Trigger points

Impact assessment should run when:
- a new issue is created from a detector
- a detector finding becomes actionable
- issue evidence bundle materially changes
- relevant entity/value data changes
- org assumptions change
- a new impact model version is activated
- user manually requests recalculation

## 15.2 Evaluation flow

1. receive issue/finding context
2. select model by detector key or issue family
3. assemble required inputs
4. resolve assumptions
5. evaluate model
6. compute confidence
7. compute normalized impact score
8. persist `impact_assessment`
9. update `issue_impact_summary`
10. publish update event for dashboards/prioritization

## 15.3 Insufficient-data behavior

If the model cannot compute a credible estimate:
- persist assessment with `assessment_status = insufficient_data`
- compute low confidence
- populate explanation of missing inputs
- update issue summary with explicit “impact unknown” or “limited estimate” state

Do not fail silently.

---

# 16. Issue View UX

Every issue detail page must include an `Impact` section with:

## 16.1 Summary cards
- Direct realized loss
- Revenue at risk
- Operational cost
- Confidence band
- Impact score

## 16.2 Assumptions drawer
Show:
- model name and version
- assumptions used
- source of each assumption
- data recency
- whether values are org-specific or default

## 16.3 Breakdown panel
Show:
- formula-style explanation
- key inputs
- affected entities/records
- why the estimate is high/low confidence

## 16.4 State handling
- High confidence estimate
- Moderate confidence estimate
- Limited estimate
- Impact unknown

Never show a raw dollar estimate without confidence context.

---

# 17. Executive and Operator Dashboards

Create an `Executive Impact Dashboard` with:

## 17.1 Core metrics
- Open direct realized loss
- Open revenue at risk
- Avoided loss
- Recovered value
- Total operational cost burden
- Verified recovered value later when available

## 17.2 Breakdowns
- by detector pack
- by issue family
- by system/provider
- by owner/team
- by status
- by confidence band

## 17.3 Trend views
- open risk over time
- realized loss over time
- avoided loss over time
- highest-risk categories over time

Create an `Operator Impact View` with:
- sortable issue queue by impact score
- confidence-aware prioritization
- filter by issue family and owner
- impact changes after recalculation

---

# 18. APIs

## 18.1 Impact model admin
- `GET /api/admin/impact/models`
- `GET /api/admin/impact/models/:modelKey`
- `GET /api/admin/impact/models/:modelKey/versions`

## 18.2 Assumptions admin
- `GET /api/admin/impact/assumptions`
- `PUT /api/admin/impact/assumptions/:assumptionKey`
- `GET /api/admin/impact/assumptions/:assumptionKey/history`

## 18.3 Issue impact
- `GET /api/issues/:issueId/impact`
- `POST /api/issues/:issueId/impact/recalculate`

## 18.4 Reporting
- `GET /api/reporting/impact/executive-summary`
- `GET /api/reporting/impact/by-detector-pack`
- `GET /api/reporting/impact/by-system`
- `GET /api/reporting/impact/by-owner`

Response payloads must always include:
- impact amounts
- currency
- confidence score and band
- impact score
- model metadata
- last calculated timestamp

---

# 19. Observability

Track:
- impact assessments created
- recalculations by reason
- average model run duration
- insufficient-data rate by model
- confidence distribution by model
- issue impact summary update failures
- assumption override frequency
- dashboard query latency for impact-heavy views

Create alerts for:
- impact engine failures
- model registry/config drift
- confidence collapse for a commonly used model
- widespread insufficient-data outcomes
- recalculation backlog growth

---

# 20. Security and Governance

Requirements:
- org assumptions changes must be auditable
- only authorized admins may override assumptions
- raw financial values must respect role-based access
- impact models must not expose secrets or sensitive provider payloads
- executive dashboards may require narrower access than issue lists in some orgs

Suggested permissions:
- `impact.read_issue`
- `impact.read_dashboard`
- `impact.read_models`
- `impact.manage_assumptions`
- `impact.recalculate`
- `impact.read_assessment_history`

---

# 21. QA and Test Strategy

## 21.1 Unit tests

Every impact model must have:
- happy path test
- missing-input fallback test
- low-confidence case
- high-confidence direct-value case
- assumption override case
- version-change regression test

## 21.2 Integration tests

Test models using:
- seeded findings
- seeded issues
- normalized signals
- canonical entities
- org assumptions
- issue summary synchronization

## 21.3 UAT scenarios

At minimum validate:
- failed payment issue receives correct at-risk estimate from invoice amount
- unrecovered payment escalates confidence correctly when recovery signals absent
- qualified lead unworked uses org conversion assumptions and response decay
- stalled opportunity uses amount and stage-age logic
- duplicate cluster produces operational cost estimate rather than fake revenue precision
- change followed by incident produces direct loss or at-risk estimate based on available severity/surface data
- issue view shows assumptions and confidence clearly
- assumption override causes recalculation and visible summary update

## 21.4 Finance/RevOps review

Before production release:
- review model outputs with RevOps or finance stakeholders
- validate baseline assumptions
- align terminology for revenue at risk vs realized loss
- confirm dashboards are decision-useful, not misleading

This review is mandatory.

---

# 22. Rollout Plan

## Milestone A — Framework
Deliver:
- impact model registry
- assumptions system
- impact assessment schema
- issue impact summary sync
- issue impact UI shell

## Milestone B — Revenue Leakage models
Deliver:
- RL1 through RL4
- assumption admin page
- executive dashboard first pass
- recalculation APIs

## Milestone C — Funnel and Data Integrity models
Deliver:
- FP1 through FP4
- DI1 through DI4
- operator sorting by impact score
- model/version history UI

## Milestone D — Change Risk models and production cutover
Deliver:
- CR1 through CR4
- dashboard breakdowns by detector pack/system
- assumption audit logs
- pilot org calibration and review complete

---

# 23. Product Decisions That Must Be Locked Before Build

1. Which currencies are supported initially
2. Whether all dashboards normalize to one org currency or support mixed-currency display
3. Which assumptions are globally seeded vs required during onboarding
4. Which issue families may show only operational-cost impact vs revenue estimates
5. Which confidence thresholds gate executive display
6. Whether low-confidence large estimates appear in default executive views
7. Which impact terms should be customer-facing in initial release
8. Whether critical-surface revenue-share assumptions are entered manually or derived later

Recommended defaults:
- initial release in single org currency
- display low-confidence estimates but label and filter them clearly
- require only a small set of onboarding assumptions
- keep model registry code-seeded in early release, assumptions admin-editable

---

# 24. Commercial Packaging Guidance for Phase 5

Impact quantification should be one of Solvren’s main upgrade levers.

Suggested framing:
- Starter: issue detection and basic severity, limited/no full impact engine
- Growth: impact cards, impact score, executive impact summary
- Enterprise: advanced impact models, assumptions management, historical recalculation, premium calibration support

Do not position impact as “analytics.” Position it as:
- economic prioritization
- executive visibility
- proof of value
- the basis for ROI justification

---

# 25. Definition of Done

Phase 5 is complete when:

1. impact model framework exists with registry, versioning, and execution engine
2. issue/finding contexts can be assessed using versioned impact models
3. impact assessments persist direct loss, at-risk value, operational cost, confidence, and impact score
4. issue impact summaries are maintained for active issues
5. org assumptions are configurable and auditable
6. issue views show impact, assumptions, and confidence clearly
7. executive dashboard shows open risk and related impact metrics
8. Revenue Leakage impact models are production-ready
9. Funnel Protection impact models are production-ready
10. Data Integrity and Attribution impact models are production-ready
11. Change Risk impact models are production-ready
12. recalculation workflows operate for assumption and model changes
13. QA and RevOps/finance review have validated outputs
14. prioritization can consume impact score and amounts without custom engineering

If these are not true, Phase 5 is not done.

---

# 26. What Phase 6 Can Assume After This Phase

After Phase 5, Phase 6 may assume:
- issues have economically meaningful prioritization signals
- routing can use impact score and value bands
- executive reporting has a defensible value layer
- detector findings now translate into ranked action queues
- product can begin proving ROI through estimated protected value before full verification is complete

---

# 27. Final Product Framing

Phase 5 is where Solvren learns to speak the language executives buy in.

By attaching explainable economic impact to issues, Solvren stops being a system that merely identifies operational problems. It becomes a platform that tells companies what those problems are worth, what should be fixed first, and how much value is being protected.

That is the bridge from operational intelligence to true revenue protection.
