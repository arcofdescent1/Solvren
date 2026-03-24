# Solvren Data Protection

**Audience:** Customer security, privacy, and compliance teams

---

## Storage

- **Primary data:** Stored in Supabase (PostgreSQL) with encryption at rest
- **Tenant isolation:** Row Level Security (RLS) enforces org boundaries; application checks provide defense in depth
- **Integration credentials:** OAuth tokens and API keys are encrypted at the application layer before storage; keys are server-side only

---

## Retention

- **Configurable retention** per resource type (audit log, notifications, tombstones)
- **Automated retention sweep** runs on a schedule to purge expired data
- **Change events** support soft delete; full org purge is a controlled process with audit and backup considerations

---

## Deletion

- **Customer offboarding:** Data deletion handled per contract and privacy commitments
- **Retention policies** define how long data is kept; deletion follows documented procedures
- **Export before deletion** available per contractual terms

---

## Data minimization

- We do not store unnecessary PII
- Logs and error tracking use redaction; secrets are never logged
- Integration payloads are processed for signals; full payloads are not retained beyond what is needed

---

## Export controls

- Export endpoints (where provided) are permission-gated
- Exports are audit-logged
- Rate limiting applies to prevent abuse
