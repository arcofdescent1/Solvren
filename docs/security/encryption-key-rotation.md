# ENCRYPTION_KEY rotation (integration credentials)

Integration OAuth tokens and secrets in `integration_credentials` may be stored with an `slv1:` envelope when `ENCRYPTION_KEY` (see `env.integrationEncryptionKey`) is set.

## Behavior

- **Plaintext legacy rows** (no `slv1:` prefix) are still read and used as-is.
- **New writes** seal sensitive columns via `sealCredentialTokenFields` / `sealIntegrationToken` in `src/lib/server/integrationTokenFields.ts`.
- **Reads** use `revealCredentialTokenFields` so `slv1:` payloads decrypt transparently.

## Rotation procedure (zero-downtime, dual-read)

1. **Generate a new key** (32-byte random, base64-encoded or as required by `src/lib/server/crypto.ts` — match existing key format).
2. **Deploy dual-read** — set **`ENCRYPTION_KEY`** to the *new* key and **`ENCRYPTION_KEY_PREVIOUS`** to the *old* key. `decryptSecret` / `revealIntegrationToken` try the primary key first, then the previous key, so existing `slv1:` rows keep working.
3. **Re-seal existing rows** (one-off script or admin job): read with `revealCredentialTokenFields`, write with `sealCredentialTokenFields` so ciphertext uses only the new key.
4. **Remove `ENCRYPTION_KEY_PREVIOUS`** once backfill is complete and spot-checks pass (Jira, Slack, HubSpot, Salesforce, NetSuite).

## Operational notes

- Production **must** set `ENCRYPTION_KEY` before relying on sealed storage; otherwise `sealIntegrationToken` throws in production when sealing.
- Back up the key in a secure manager; loss of the key means tokens must be re-authorized with each provider.
- `Sentry` and logs must not include raw tokens (see `sentry.server.config.ts` scrub rules).

## Related

- `src/lib/server/crypto.ts` — AES-GCM envelope for `encryptSecret` / `decryptSecret`.
- `docs/security-phase0.md` — broader Phase 0/1 security checklist.
