/**
 * Phase 3 — Stripe invoice.payment_failed mapper (§13).
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "stripe.invoice.payment_failed";
const MAPPER_VERSION = "1.0.0";

export class StripeInvoicePaymentFailedMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    return (
      ctx.provider === "stripe" &&
      (ctx.eventType === "invoice.payment_failed" || ctx.eventType === "invoice.payment_failure")
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p = ctx.payload as Record<string, unknown>;
    const invoice = (p.invoice ?? p.data?.object ?? p) as Record<string, unknown>;
    const invoiceId = String(invoice?.id ?? ctx.externalObjectId ?? "");
    const amount = (invoice?.amount_due ?? invoice?.amount_paid ?? 0) as number;
    const failureCode = (invoice?.last_finalization_error?.code ?? p.last_payment_error?.code ?? "unknown") as string;
    const customerId = (invoice?.customer ?? p.customer) as string | undefined;

    const entityCandidates = [];
    if (customerId) entityCandidates.push(entityCandidate("stripe", "customer", customerId, "person", 0.9));
    if (invoiceId) entityCandidates.push(entityCandidate("stripe", "invoice", invoiceId, "invoice", 1));

    return baseMapperResult("payment_failed", ctx, {
      dimensions: { failure_code: failureCode },
      measures: { amount },
      references: { invoice_id: invoiceId, customer_id: customerId ?? null },
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
