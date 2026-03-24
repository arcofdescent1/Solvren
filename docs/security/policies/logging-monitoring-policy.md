# Logging and monitoring policy

**Applies to:** Application logs, audit logs, error tracking, and operational alerts for Solvren production.

**Owner:** Engineering Lead (Audit logging / Monitoring) — see [`../security-ownership.md`](../security-ownership.md).

**Related controls:** LM-01–LM-04 in [`../control-matrix.md`](../control-matrix.md).  
**Data handling:** [`data-handling-policy.md`](data-handling-policy.md).

---

## 1. Purpose

Ensure security-relevant events are logged appropriately, errors are visible, alerts reach responsible people, and evidence retention supports reviews without storing secrets.

---

## 2. What must be logged

At minimum, the following categories should be covered where technically feasible:

- **Authentication outcomes** (success/failure at app boundary as appropriate — avoid excessive PII)
- **Authorization denials** for sensitive admin or privileged operations (aggregated or sampled if volume is high)
- **Security-relevant mutations:** membership changes, role changes, integration credential changes, privileged job triggers
- **Audit trail** in database (`audit_log` or successor) for actions defined in the audit action catalog

---

## 3. What must never be logged

See **data-handling policy**: secrets, raw tokens, encryption keys, full credential payloads, and similar **highly confidential** material must not appear in application logs, error trackers, or unstructured debug output.

**Sentry (or equivalent)** must use **scrubbing / before-send** hooks to strip sensitive fields; configuration evidence stored in `evidence/configuration/`.

---

## 4. Error monitoring

- **Production errors** are collected in an approved error tracking tool with access limited to engineering.
- **Triage:** Critical error spikes or new error types are investigated per operational norms; **customer-impacting** issues escalate per incident runbook.

---

## 5. Alert severity handling

| Alert type | Expectation |
|------------|-------------|
| **Page / immediate** | Production down, auth broken, data corruption suspected, security exploit active |
| **Same business day** | Elevated error rate, job backlog, integration degradation |
| **Tracked / weekly** | Non-critical warnings, capacity planning signals |

Document actual routing (Slack, email, PagerDuty) in [`../incident-response-runbook.md`](../incident-response-runbook.md) and update when it changes.

---

## 6. Evidence retention

- **Audit logs:** Retention per product retention policy and legal requirements; documented with data lifecycle jobs.
- **Error tracker:** Retention per vendor default unless contracted otherwise; export samples for evidence if needed.
- **Access to logs** is limited to authorized engineering and operations roles.

---

## 7. Review

This policy is reviewed **at least annually** and after any logging breach (e.g., secret logged).
