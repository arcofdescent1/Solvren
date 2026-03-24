/**
 * Phase 4 — Connector manifest schema for validation and SDK consumers.
 */
import { z } from "zod";

export const ConnectorManifestSchema = z.object({
  provider: z.string().min(1),
  displayName: z.string().min(1),
  category: z.enum(["crm", "payments", "communication", "work_management", "engineering", "erp", "file_import", "database", "warehouse"]),
  description: z.string(),
  authType: z.enum(["oauth2", "api_key", "basic", "service_account", "custom"]),
  supportedSyncModes: z.array(z.enum(["polling", "webhook", "hybrid", "manual"])),
  capabilities: z.array(z.enum(["read_objects", "receive_events", "execute_actions", "health_checks", "schema_discovery", "backfill", "incremental_sync"])),
  supportedObjectTypes: z.array(z.string()),
  supportedInboundEvents: z.array(z.string()),
  supportedOutboundActions: z.array(z.string()),
  requiredScopes: z.array(z.string()),
  optionalScopes: z.array(z.string()),
  installPrerequisites: z.array(z.string()),
  docsUrl: z.string().optional(),
  iconAssetKey: z.string(),
  healthCheckStrategy: z.enum(["api_probe", "token_validation", "webhook_heartbeat", "hybrid"]),
  minimumPlan: z.enum(["starter", "growth", "enterprise"]),
  isTierOne: z.boolean(),
});

export type ConnectorManifestInput = z.infer<typeof ConnectorManifestSchema>;
