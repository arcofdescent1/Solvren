import { getStripe } from "@/lib/stripe";
import type { OrgPurgeStepContext } from "../step-context";

export async function runPurgeBillingStep(ctx: OrgPurgeStepContext): Promise<Record<string, unknown>> {
  const { data: billing, error } = await ctx.admin.from("billing_accounts").select("*").eq("org_id", ctx.orgId).maybeSingle();
  if (error) throw new Error(`purge_billing read: ${error.message}`);

  if (ctx.dryRun) {
    return { dryRun: true, hasBillingRow: !!billing };
  }

  if (!billing) {
    return { snapshot: false, reason: "no_billing_accounts_row" };
  }

  const { error: snapErr } = await ctx.admin.from("org_purge_finance_retention_snapshots").insert({
    run_id: ctx.runId,
    target_org_id: ctx.orgId,
    snapshot_json: billing as Record<string, unknown>,
    reason_code: "RETAIN_FINANCE",
  });
  if (snapErr) throw new Error(`purge_billing snapshot: ${snapErr.message}`);

  let stripeCancelled: string | null = null;
  const subId = (billing as { stripe_subscription_id?: string | null }).stripe_subscription_id;
  const stripe = getStripe();
  if (stripe && subId) {
    try {
      await stripe.subscriptions.cancel(subId);
      stripeCancelled = subId;
    } catch (e) {
      stripeCancelled = `failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return { snapshot: true, stripeCancelled };
}
