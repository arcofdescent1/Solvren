/**
 * Phase 1 — One-time migration: copy existing integration_connections into integration_accounts.
 * Run with: npx tsx scripts/migrate-integration-connections-to-phase1.ts
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { getProviderManifest } from "../src/modules/integrations/registry/getProviderManifest";
import { hasProvider } from "../src/modules/integrations/registry/providerRegistry";

const PHASE1_PROVIDERS = ["hubspot", "salesforce", "stripe", "slack", "jira", "github", "netsuite"] as const;

function mapStatus(legacy: string): "not_installed" | "installing" | "connected" | "connected_limited" | "degraded" | "syncing" | "action_limited" | "auth_expired" | "error" | "disconnected" {
  switch (legacy) {
    case "connected":
      return "connected";
    case "configured":
      return "connected_limited";
    case "connecting":
      return "installing";
    case "error":
      return "error";
    case "disconnected":
      return "disconnected";
    default:
      return "connected";
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from("integration_connections")
    .select("id, org_id, provider, status, config, health_status, last_success_at, last_error");

  if (error) {
    console.error("Failed to read integration_connections:", error.message);
    process.exit(1);
  }

  const conns = (rows ?? []).filter((r: { provider: string }) => PHASE1_PROVIDERS.includes(r.provider as typeof PHASE1_PROVIDERS[number]));
  console.log(`Found ${conns.length} integration_connections for Phase 1 providers.`);

  let created = 0;
  let skipped = 0;

  for (const c of conns as Array<{ id: string; org_id: string; provider: string; status: string; config: Record<string, unknown>; health_status?: string; last_success_at?: string; last_error?: string }>) {
    if (!hasProvider(c.provider)) continue;

    const { data: existing } = await supabase
      .from("integration_accounts")
      .select("id")
      .eq("org_id", c.org_id)
      .eq("provider", c.provider)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const manifest = getProviderManifest(c.provider);
    const displayName = manifest?.displayName ?? c.provider;
    const category = manifest?.category ?? "crm";
    const authType = manifest?.authType ?? "oauth2";

    const lastError = c.last_error ?? null;
    const { error: insertErr } = await supabase.from("integration_accounts").insert({
      org_id: c.org_id,
      provider: c.provider,
      display_name: displayName,
      category,
      auth_type: authType,
      status: mapStatus(c.status),
      connection_mode: "oauth",
      installed_by_user_id: null,
      installed_at: null,
      disconnected_at: c.status === "disconnected" ? new Date().toISOString() : null,
      last_success_at: c.last_success_at ?? null,
      last_error_at: lastError ? new Date().toISOString() : null,
      last_error_code: null,
      last_error_message: lastError,
      health_summary_json: c.health_status ? { overall: c.health_status } : {},
      scopes_granted_json: [],
      scopes_missing_json: [],
      config_json: c.config ?? {},
      secrets_ref: null,
      metadata_json: { migrated_from: "integration_connections", legacy_id: c.id },
    });

    if (insertErr) {
      console.error(`Failed to create integration_account for org=${c.org_id} provider=${c.provider}:`, insertErr.message);
      continue;
    }
    created++;
    console.log(`Created integration_account: org=${c.org_id} provider=${c.provider}`);
  }

  console.log(`Done. Created ${created}, skipped (already exist) ${skipped}.`);
}

main();
