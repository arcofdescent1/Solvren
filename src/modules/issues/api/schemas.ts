/**
 * Phase 0 — Zod schemas for issue API request/response validation.
 */
import { z } from "zod";

const issueSourceType = z.enum([
  "change",
  "detector",
  "integration_event",
  "incident",
  "manual",
  "system_health",
  "verification_failure",
]);
const issueSeverity = z.enum(["low", "medium", "high", "critical"]);
const verificationStatus = z.enum(["pending", "passed", "failed", "not_required"]);

export const CreateIssueFromSourceSchema = z.object({
  sourceType: issueSourceType,
  sourceRef: z.string().min(1),
  sourceEventTime: z.string().optional(),
  domainKey: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  summary: z.string().optional(),
  severity: issueSeverity.optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  sourceEvidence: z.record(z.string(), z.unknown()).optional(),
  entities: z
    .array(
      z.object({
        entityType: z.string(),
        externalSystem: z.string(),
        externalObjectType: z.string().optional(),
        externalId: z.string(),
        entityDisplayName: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  links: z.object({ changeIds: z.array(z.string().uuid()).optional() }).optional(),
});

export const TriageIssueSchema = z.object({
  domainKey: z.string().min(1).optional(),
  severity: issueSeverity.optional(),
  priorityScore: z.number().optional(),
  summary: z.string().optional(),
});

export const AssignIssueSchema = z.object({
  ownerUserId: z.string().uuid().optional(),
  ownerTeamKey: z.string().optional(),
  routingRationale: z.string().optional(),
}).refine((d) => d.ownerUserId != null || d.ownerTeamKey != null, {
  message: "At least one of ownerUserId or ownerTeamKey is required",
});

export const StartIssueSchema = z.object({}).optional();

export const ResolveIssueSchema = z.object({
  resolutionSummary: z.string().min(1),
  verificationType: z.enum(["rule_recheck", "integration_probe", "manual_attestation", "metric_delta"]).optional(),
  waiveVerification: z.boolean().optional(),
});

export const DismissIssueSchema = z.object({
  reason: z.enum(["duplicate", "false_positive", "accepted_risk", "obsolete"]),
  notes: z.string().optional(),
});

export const ReopenIssueSchema = z.object({
  reason: z.string().min(1),
  expectedLifecycleVersion: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

/** Phase 1 lifecycle schemas */
export const LifecycleCloseSchema = z.object({
  expectedLifecycleVersion: z.number().int().min(1),
  terminalClassification: z.object({
    classificationType: z.enum(["resolved_success", "resolved_failure", "no_action_closed"]),
    outcomeSummary: z.string().min(1),
    outcomePayload: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const LifecycleNoActionSchema = z.object({
  expectedLifecycleVersion: z.number().int().min(1),
  reason: z.enum([
    "false_positive",
    "duplicate_of_existing_issue",
    "accepted_business_risk",
    "insufficient_permissions",
    "external_blocker_unresolvable",
    "customer_declined_action",
    "informational_only",
    "test_or_demo_artifact",
  ]),
  notes: z.string().optional(),
});

export const LifecycleReopenSchema = z.object({
  expectedLifecycleVersion: z.number().int().min(1),
  reason: z.string().min(1),
  notes: z.string().optional(),
});

export const AddIssueCommentSchema = z.object({
  body: z.string().min(1),
  visibility: z.enum(["internal", "restricted"]).optional(),
});

export const ListIssuesQuerySchema = z.object({
  status: z.string().optional(),
  source_type: z.string().optional(),
  severity: z.string().optional(),
  domain_key: z.string().optional(),
  verification_status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export type CreateIssueFromSourceInput = z.infer<typeof CreateIssueFromSourceSchema>;
export type TriageIssueInput = z.infer<typeof TriageIssueSchema>;
export type AssignIssueInput = z.infer<typeof AssignIssueSchema>;
export type ResolveIssueInput = z.infer<typeof ResolveIssueSchema>;
export type DismissIssueInput = z.infer<typeof DismissIssueSchema>;
export type ReopenIssueInput = z.infer<typeof ReopenIssueSchema>;
export type AddIssueCommentInput = z.infer<typeof AddIssueCommentSchema>;
