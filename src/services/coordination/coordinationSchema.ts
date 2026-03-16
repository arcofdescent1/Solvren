import { z } from "zod";

export const coordinationPlanSchema = z.object({
  summary: z.object({
    coordinationSummary: z.string().min(1),
    whyTheseRecommendationsExist: z.string().min(1),
  }),
  approvals: z.object({
    suggestedApprovers: z.array(
      z.object({
        userId: z.string().min(1),
        displayName: z.string().min(1),
        role: z.string().min(1),
        source: z.enum(["DOMAIN_MAPPING", "SYSTEM_MAPPING", "CHANGE_TYPE_MAPPING", "MANUAL_RULE"]),
        required: z.boolean(),
        reason: z.string().min(1),
      })
    ),
    missingCoverage: z.array(
      z.object({
        type: z.enum(["DOMAIN", "SYSTEM", "CHANGE_TYPE"]),
        value: z.string().min(1),
        reason: z.string().min(1),
      })
    ),
  }),
  evidence: z.object({
    requiredItems: z.array(
      z.object({
        kind: z.string().min(1),
        title: z.string().min(1),
        reason: z.string().min(1),
        source: z.enum(["CHANGE_TYPE_RULE", "SYSTEM_RULE", "DOMAIN_RULE", "RISK_RULE"]),
      })
    ),
    recommendedItems: z.array(
      z.object({
        kind: z.string().min(1),
        title: z.string().min(1),
        reason: z.string().min(1),
        source: z.enum(["CHANGE_TYPE_RULE", "SYSTEM_RULE", "DOMAIN_RULE", "RISK_RULE"]),
      })
    ),
  }),
  notifications: z.object({
    suggestedRecipients: z.array(
      z.object({
        recipientType: z.enum(["USER", "ROLE", "EMAIL_LIST", "SLACK_CHANNEL"]),
        recipientId: z.string().min(1),
        displayName: z.string().min(1),
        channel: z.enum(["IN_APP", "EMAIL", "SLACK"]),
        reason: z.string().min(1),
      })
    ),
  }),
  blockers: z.array(
    z.object({
      code: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      severity: z.enum(["ERROR", "WARNING"]),
    })
  ),
  actions: z.object({
    canApplyApprovers: z.boolean(),
    canApplyEvidence: z.boolean(),
    canApplyNotifications: z.boolean(),
  }),
});
