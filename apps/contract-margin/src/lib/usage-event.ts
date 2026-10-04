import { z } from "zod";

export const usageEvent = z.strictObject({
  eventId: z.string().min(1).max(200),
  organizationId: z.uuid(),
  customerId: z.string().min(1).max(200),
  workflowId: z.string().min(1).max(200),
  runId: z.string().min(1).max(200),
  provider: z.enum(["openai", "anthropic"]),
  billingRoute: z.enum(["openai_direct", "anthropic_direct", "gateway_or_cloud", "other"]),
  model: z.string().min(1).max(200),
  inputTokens: z.int().nonnegative(),
  outputTokens: z.int().nonnegative(),
  cacheReadTokens: z.int().nonnegative().optional(),
  cacheWriteTokens: z.int().nonnegative().optional(),
  reasoningOutputTokens: z.int().nonnegative().optional(),
  reportedCostUsd: z.string().regex(/^\d+(\.\d{1,8})?$/).optional(),
  occurredAt: z.iso.datetime({ offset: true }),
  status: z.enum(["succeeded", "failed"]),
}).superRefine((event, context) => {
  if (event.billingRoute === "openai_direct" && event.provider !== "openai") {
    context.addIssue({ code: "custom", path: ["billingRoute"], message: "Provider and billing route disagree" });
  }
  if (event.billingRoute === "anthropic_direct" && event.provider !== "anthropic") {
    context.addIssue({ code: "custom", path: ["billingRoute"], message: "Provider and billing route disagree" });
  }
});

export type UsageEvent = z.infer<typeof usageEvent>;

export function parseUsageEvent(value: unknown): UsageEvent {
  return usageEvent.parse(value);
}
