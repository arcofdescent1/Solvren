/**
 * Phase 1 — Context passed for lifecycle operations.
 */
export type LifecycleActorType = "system" | "user" | "workflow" | "detector" | "verification_engine";

export type LifecycleContext = {
  actorType: LifecycleActorType;
  actorUserId?: string | null;
  correlationId?: string | null;
  eventReason?: string | null;
  eventPayload?: Record<string, unknown>;
};
