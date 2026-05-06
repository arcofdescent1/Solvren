# JSON payload storage triage

Group work is at the **storage surface** level (table + column, or API route + table), not per source line.  
Download the latest `json-payload-storage-inventory.json` from the **Security baseline** CI job artifact and map each distinct `ref` here.

| Area | Storage surface (table.column or route → table) | Risk | Classification | Required action | Owner |
|------|-------------------------------------------------|-----:|----------------|-----------------|-------|
| _Example_ | `integration_webhook_events.payload_json` | High | needs_redaction | Phase 2 redaction pipeline | TBD |
| _Example_ | `/api/integrations/hubspot/webhook → integration_inbound_events` | High | needs_redaction | Classify + minimize retention | TBD |

### Classification values

- `safe_metadata` — structured internal config, no customer PII
- `needs_redaction` — may contain customer or third-party payload data; minimize or redact in Phase 2
- `must_encrypt` — sensitive fields must be encrypted at rest or removed
- `must_delete` — retention should be zero or time-bounded delete
- `false_positive` — not a persistence surface (document why)

When the inventory artifact changes after migrations or new routes, add or update rows for **new storage surfaces** only.
