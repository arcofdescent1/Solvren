/** Phase 1 — static templates only (no LLM). */

export const RECOMMENDED_ACTIONS: Record<string, string> = {
  stripe_failed_payments:
    "Retry failed payments in Stripe, verify payment methods, and notify affected customers.",
  stripe_high_refund_rate:
    "Review refund reasons and product/pricing issues; tighten refund policy communication.",
  stripe_retry_exhaustion:
    "Contact customers with exhausted retries and offer an alternate payment path.",
  stripe_payment_dropoff:
    "Send recovery emails or SMS for abandoned checkouts and simplify payment UX.",
  stripe_large_failed:
    "Prioritize manual review for large failed transactions and reach out to those accounts.",
  stripe_subscription_renewal_failure:
    "Investigate subscription invoices that failed to renew; update payment method or retry billing.",
  stripe_churn_spike:
    "Review recent cancellations for pricing, product fit, and onboarding; intervene with save offers where appropriate.",
  stripe_payment_method_expiration_risk:
    "Contact customers with cards expiring soon and prompt them to update saved payment methods.",
  stripe_high_value_payment_failure:
    "Treat large-dollar failed payments as revenue-critical: escalate recovery and customer outreach.",
  stripe_refund_spike_anomaly:
    "Investigate the spike in refunds vs recent baseline; check disputes, product defects, and policy abuse.",
  hubspot_duplicate_contacts:
    "Merge duplicate HubSpot contacts and enforce unique email rules going forward.",
  hubspot_no_followup_leads:
    "Assign owners and schedule calls or emails for leads with no recent activity.",
  hubspot_missing_lifecycle:
    "Set lifecycle stages for contacts missing classification.",
  hubspot_stalled_deals:
    "Review stalled open deals and schedule next-step meetings or stage updates.",
  hubspot_orphan_contacts:
    "Link orphan contacts to deals or accounts or convert them with a clear next step.",
  salesforce_stale_opportunities:
    "Update or close stale Salesforce opportunities and refresh next steps.",
  salesforce_missing_owner:
    "Assign owners to opportunities missing ownership.",
};
