/**
 * Phase 2 — Get Stripe client for org (org-specific API key).
 */
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export async function getStripeClientForOrg(orgId: string): Promise<Stripe | null> {
  const admin = createAdminClient();
  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (!credsRaw) return null;

  const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>) as {
    access_token?: string;
  };
  const secretKey = creds.access_token;
  if (!secretKey) return null;

  return new Stripe(secretKey, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}
