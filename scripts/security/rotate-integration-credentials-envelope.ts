/**
 * Batch re-wrap integration_credentials token columns to env1 envelope.
 * Uses ENCRYPTION_KEY (+ optional ENCRYPTION_KEY_PREVIOUS for decrypt). Logs no secrets.
 *
 * Usage:
 *   npx tsx scripts/security/rotate-integration-credentials-envelope.ts [--dry-run] [--batch=100] [--resume-after=<uuid>]
 */
import { createClient } from "@supabase/supabase-js";
import {
  decryptAnyStoredSecretFormat,
  encryptEnv1EnvelopeString,
  ENV1_PREFIX,
} from "../../src/lib/server/crypto";

const TOKEN_COLS = [
  "access_token",
  "refresh_token",
  "client_secret",
  "private_app_token",
  "jwt_private_key_base64",
] as const;

function parseArgs() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  let batch = 100;
  let resumeAfter = "";
  for (const a of argv) {
    if (a.startsWith("--batch=")) batch = Math.min(500, Math.max(1, Number(a.split("=")[1]) || 100));
    if (a.startsWith("--resume-after=")) resumeAfter = a.split("=")[1]?.trim() ?? "";
  }
  return { dryRun, batch, resumeAfter };
}

async function main() {
  const { dryRun, batch, resumeAfter } = parseArgs();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let q = supabase.from("integration_credentials").select("*").order("id", { ascending: true }).limit(batch);

  if (resumeAfter) {
    q = q.gt("id", resumeAfter);
  }

  const { data: rows, error } = await q;
  if (error) {
    console.error("query failed", error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log(JSON.stringify({ ok: true, processed: 0, message: "no rows" }));
    return;
  }

  let ok = 0;
  let failed = 0;
  let lastId = "";

  for (const row of rows as unknown as Record<string, unknown>[]) {
    lastId = String(row.id ?? "");
    const patch: Record<string, unknown> = {};
    try {
      for (const col of TOKEN_COLS) {
        const v = row[col];
        if (typeof v !== "string" || v.length === 0) continue;
        if (v.startsWith(ENV1_PREFIX)) continue;
        const plain = decryptAnyStoredSecretFormat(v);
        patch[col] = encryptEnv1EnvelopeString(plain);
      }

      if (Object.keys(patch).length === 0) {
        ok++;
        continue;
      }

      patch.secret_status = "encrypted";
      patch.encryption_version = process.env.SOLVREN_ACTIVE_KEY_VERSION ?? "v1";
      patch.credentials_encrypted_at = new Date().toISOString();

      console.log(
        JSON.stringify({
          integration_account_id: null,
          credential_types: Object.keys(patch).filter((k) => (TOKEN_COLS as readonly string[]).includes(k)),
          org_id: row.org_id,
          provider: row.provider,
          status: row.secret_status,
          row_id: row.id,
          dry_run: dryRun,
        }),
      );

      if (!dryRun) {
        const { error: upErr } = await supabase.from("integration_credentials").update(patch).eq("id", row.id);
        if (upErr) throw new Error(upErr.message);
      }
      ok++;
    } catch (e) {
      failed++;
      console.error(
        JSON.stringify({
          row_id: row.id,
          org_id: row.org_id,
          provider: row.provider,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  console.log(JSON.stringify({ ok: failed === 0, processed: ok, failed, last_processed_id: lastId, dry_run: dryRun }));
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
