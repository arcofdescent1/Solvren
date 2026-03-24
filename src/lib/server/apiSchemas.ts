import { z } from "zod";

export const uuidParam = z.string().uuid();

export const orgIdQuery = z.object({
  orgId: z.string().uuid(),
});

/** Revenue policy POST (settings). */
export const revenuePolicyCreateSchema = z.object({
  name: z.string().trim().min(1).max(500),
  description: z.string().max(10_000).optional(),
  rule_type: z.string().trim().max(200).default("CUSTOM"),
  rule_config: z.record(z.string(), z.unknown()).optional(),
  systems_affected: z.array(z.string()).optional(),
  enforcement_mode: z.enum(["MONITOR", "REQUIRE_APPROVAL", "BLOCK"]),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1_000_000).optional(),
});

export const revenuePolicyPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(10_000).nullable().optional(),
    rule_type: z.string().trim().max(200).optional(),
    rule_config: z.record(z.string(), z.unknown()).optional(),
    systems_affected: z.array(z.string()).optional(),
    enforcement_mode: z.enum(["MONITOR", "REQUIRE_APPROVAL", "BLOCK"]).optional(),
    enabled: z.boolean().optional(),
    priority: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();

export const notificationRetryBodySchema = z.object({
  outboxId: z.string().uuid(),
});
