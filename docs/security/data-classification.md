# Data classification (Phase 1)

Internal reference for handling customer and operational data.

| Class | Examples | Handling |
|-------|-----------|----------|
| **Restricted** | Integration access/refresh tokens, service role keys, webhook signing secrets | Encrypt at rest (see `src/lib/server/crypto.ts`), never log, Sentry scrubbing, server-only |
| **Restricted** | User emails, auth identifiers | Minimize in logs; audit without raw tokens |
| **Restricted** | Revenue-sensitive metrics, deal values, customer identifiers in issues/changes | RLS + org scope; export gated |
| **Internal** | Issues, changes, settings, policy decisions, operational logs | RLS; standard audit on mutation |
| **Low** | Non-sensitive UI preferences, display metadata | Avoid PII; OK in app settings |

**Rule:** When in doubt, treat as **Restricted** until reviewed.
