/**
 * Phase 2 — Stripe mapping template definitions.
 */
export const STRIPE_MAPPING_TEMPLATES = [
  {
    provider_key: "stripe",
    source_object_type: "customer",
    canonical_object_type: "Customer",
    name: "Stripe Customer → Customer",
    fields: [
      { source_path: "id", canonical_field: "externalId" },
      { source_path: "email", canonical_field: "email" },
      { source_path: "name", canonical_field: "companyName" },
    ],
  },
  {
    provider_key: "stripe",
    source_object_type: "payment_intent",
    canonical_object_type: "Transaction",
    name: "Stripe PaymentIntent → Transaction",
    fields: [
      { source_path: "id", canonical_field: "externalId" },
      { source_path: "amount", canonical_field: "amount" },
      { source_path: "currency", canonical_field: "currency" },
      { source_path: "created", canonical_field: "occurredAt" },
    ],
  },
  {
    provider_key: "stripe",
    source_object_type: "charge",
    canonical_object_type: "Transaction",
    name: "Stripe Charge → Transaction",
    fields: [
      { source_path: "id", canonical_field: "externalId" },
      { source_path: "amount", canonical_field: "amount" },
      { source_path: "currency", canonical_field: "currency" },
      { source_path: "created", canonical_field: "occurredAt" },
    ],
  },
  {
    provider_key: "stripe",
    source_object_type: "invoice",
    canonical_object_type: "Transaction",
    name: "Stripe Invoice → Transaction",
    fields: [
      { source_path: "id", canonical_field: "externalId" },
      { source_path: "amount_paid", canonical_field: "amount" },
      { source_path: "currency", canonical_field: "currency" },
      { source_path: "created", canonical_field: "occurredAt" },
    ],
  },
  {
    provider_key: "stripe",
    source_object_type: "dispute",
    canonical_object_type: "IssueSignal",
    name: "Stripe Dispute → IssueSignal",
    fields: [
      { source_path: "id", canonical_field: "externalId" },
      { source_path: "reason", canonical_field: "signalType" },
    ],
  },
];
