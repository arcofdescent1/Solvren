/**
 * Phase 3 — Stripe retry_payment action handler.
 * Retries a failed invoice payment. Idempotent per invoice.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClientForOrg } from "../stripeClientForOrg";
import type { ActionExecutionResult } from "../../../contracts/runtime";

export async function executeStripeRetryPayment(
  _admin: SupabaseClient,
  input: {
    orgId: string;
    params: Record<string, unknown>;
  }
): Promise<ActionExecutionResult> {
  const invoiceId = input.params.invoiceId as string | undefined;

  if (!invoiceId?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "invoiceId is required" };
  }

  const stripe = await getStripeClientForOrg(input.orgId);
  if (!stripe) {
    return { success: false, errorCode: "NOT_FOUND", errorMessage: "Stripe not connected" };
  }

  try {
    const invoice = await stripe.invoices.pay(invoiceId.trim());
    const paid = invoice.status === "paid";
    const inv = invoice as { id?: string; payment_intent?: string | { id?: string } };
    const extId =
      typeof inv.payment_intent === "string"
        ? inv.payment_intent
        : inv.payment_intent?.id ?? inv.id ?? invoiceId;
    return {
      success: true,
      externalId: extId,
      message: paid ? "Invoice paid successfully" : `Invoice status: ${invoice.status}`,
    };
  } catch (e: unknown) {
    const err = e as { type?: string; code?: string; message?: string };
    const msg = err?.message ?? "Stripe API failed";
    const code =
      msg.includes("401") || msg.includes("403")
        ? "AUTH_ERROR"
        : msg.includes("invoice is already paid") || err?.code === "invoice_payment_intent_requires_action"
          ? "PROVIDER_ERROR"
          : msg.includes("card_") || msg.includes("insufficient")
            ? "VALIDATION_ERROR"
            : "PROVIDER_ERROR";
    return { success: false, errorCode: code, errorMessage: msg };
  }
}
