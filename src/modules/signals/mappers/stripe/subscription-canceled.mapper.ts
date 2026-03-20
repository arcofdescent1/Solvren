/**
 * Phase 3 — Stripe subscription canceled mapper (§13).
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "stripe.subscription.canceled";
const MAPPER_VERSION = "1.0.0";

export class StripeSubscriptionCanceledMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    return (
      ctx.provider === "stripe" &&
      (ctx.eventType === "customer.subscription.deleted" || ctx.eventType === "customer.subscription.updated")
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p = ctx.payload as Record<string, unknown>;
    const sub = (p.data?.object ?? p.object ?? p) as Record<string, unknown>;
    const subId = String(sub?.id ?? ctx.externalObjectId ?? "");
    const customerId = sub?.customer as string | undefined;
    const status = (sub?.status ?? "") as string;

    if (ctx.eventType === "customer.subscription.updated" && status !== "canceled" && status !== "unpaid") {
      return null;
    }

    const entityCandidates = [entityCandidate("stripe", "subscription", subId, "subscription", 1)];
    if (customerId) entityCandidates.push(entityCandidate("stripe", "customer", String(customerId), "person", 0.9));

    const cancelReason = (sub?.cancellation_details?.reason ?? sub?.cancel_at_period_end) as string | undefined;

    return baseMapperResult("subscription_canceled", ctx, {
      dimensions: { cancel_reason: cancelReason ?? (status === "canceled" ? "canceled" : "unknown") },
      measures: { mrr: 0 },
      references: {},
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
