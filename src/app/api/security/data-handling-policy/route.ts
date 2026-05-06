import { NextResponse } from "next/server";

/**
 * GET /api/security/data-handling-policy — public product policy (not org-specific).
 */
export async function GET() {
  return NextResponse.json({
    product: "Solvren",
    rawPayloadStorage: "disabled_by_policy",
    piiHandling: "hash_or_redact",
    credentials: "encrypted_envelope",
    operationalEvents: "sanitized",
    writeBackDefault: "disabled_until_customer_enables",
    privacyModes: {
      minimal: {
        label: "Minimal Data Mode — Recommended",
        description: "Uses event counts, failure rates, customer-entered estimates, and system defaults.",
      },
      expanded: {
        label: "Expanded Insights Mode — Optional",
        description:
          "Adds limited derived financial signals, rounded bands, and aggregated averages. No raw revenue payloads.",
      },
    },
    roi: {
      nature: "directional_estimate",
      disclaimer:
        "Estimated impact is directional and based on operational signals, failure rates, and configured assumptions. It is not an audited financial measure.",
    },
    lastUpdated: "2026-05-06",
  });
}
