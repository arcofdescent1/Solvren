/**
 * Unified credential / decrypt guardrails (Phase 1 + Phase 3).
 * - Flags likely plaintext credential fields on DB writes.
 * - Flags decryptSecret( / decryptAnyStoredSecretFormat( outside allowlisted modules.
 *
 * Suppress on same or immediately previous non-empty line:
 *   // solvren-security-exception: SEC-123 reason
 *
 * SQL migrations under supabase/migrations are not scanned.
 */
import { readFileSync } from "node:fs";
import fg from "fast-glob";

const suppression = /\/\/\s*solvren-security-exception:\s*(\S+)(?:\s+.*)?$/;

function lineSuppressed(lines, idx) {
  const line = lines[idx] ?? "";
  if (suppression.test(line.trim())) return true;
  for (let j = idx - 1; j >= 0; j--) {
    const prev = lines[j].trim();
    if (prev === "") continue;
    return suppression.test(prev);
  }
  return false;
}

const files = fg.sync(
  ["middleware.ts", "src/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx,mjs,js}"],
  {
    ignore: [
      "node_modules/**",
      ".next/**",
      "scripts/security/check-security-violations.mjs",
      "**/*.test.*",
      "**/*.spec.*",
      "**/__tests__/**",
      "supabase/migrations/**",
    ],
  },
);

const suspiciousFields = [
  "access_token",
  "refresh_token",
  "private_app_token",
  "client_secret",
  "secret_key",
  "api_key",
  "password",
];

const writePatterns = [".insert(", ".upsert(", ".update("];

const writeAllowlistSubstrings = [
  "credentials_encrypted",
  "encryptSecret(",
  "decryptSecret(",
  "decryptAnyStoredSecretFormat(",
  "sealCredentialTokenFields(",
  "encryptSecretForIntegrationStorage(",
  "encryptEnv1EnvelopeString(",
  "hashed",
  "token_hash",
];

const decryptAllowSuffixes = [
  "src/lib/server/crypto.ts",
  "src/lib/server/integrationTokenFields.ts",
  "src/modules/integrations/secrets/integration-secrets.service.ts",
  "scripts/security/rotate-integration-credentials-envelope.ts",
];

function isDecryptAllowedFile(rel) {
  const n = rel.replaceAll("\\", "/");
  return decryptAllowSuffixes.some((s) => n.endsWith(s));
}

let failed = false;

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  const rel = file.replaceAll("\\", "/");

  const writesToDb = writePatterns.some((pattern) => content.includes(pattern));
  if (writesToDb && suspiciousFields.some((field) => content.includes(field))) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!writePatterns.some((p) => line.includes(p))) continue;
      if (!suspiciousFields.some((f) => line.includes(f))) continue;
      if (writeAllowlistSubstrings.some((p) => line.includes(p))) continue;
      if (lineSuppressed(lines, i)) continue;
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) continue;
      console.error(`Possible plaintext credential persistence in ${file}:${i + 1}`);
      failed = true;
    }
  }

  if (!isDecryptAllowedFile(rel)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("decryptSecret(") && !line.includes("decryptAnyStoredSecretFormat(")) continue;
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) continue;
      if (lineSuppressed(lines, i)) continue;
      console.error(`Disallowed decrypt call in ${file}:${i + 1}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error(
    "Security violations: encrypt secrets before persistence; route decrypts through integration-secrets.service / integrationTokenFields / crypto. " +
      "Suppress with // solvren-security-exception: SEC-123 reason",
  );
  process.exit(1);
}
