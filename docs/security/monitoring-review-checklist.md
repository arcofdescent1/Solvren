# Monitoring review checklist

**Purpose:** Ensure alerts are meaningful, actionable, and not silently failing. A noisy alert that everyone ignores is a broken control.

**Owner:** Engineering Lead  
**Cadence:** Weekly (critical review); Monthly (full review)  
**Evidence:** `evidence/monitoring/YYYY-MM-monitoring-review.md`

---

## Weekly scope

- [ ] Review **critical alerts** — Pages, urgent items; confirm triaged
- [ ] Review **repeated warning patterns** — Same error recurring? Action needed?
- [ ] Review **alert routing health** — Are alerts reaching the right people? Any channel failures?

---

## Monthly scope

- [ ] Validate **alert coverage** against current architecture
- [ ] Spot-check **alert noise vs usefulness** — Too many false positives?
- [ ] Confirm **scrubbing still works** for sensitive data (Sentry before-send, etc.)

---

## Review scope (detail)

Include:

| Area | What to check |
|------|---------------|
| **Sentry** | Issues, alert routing, new error types |
| **Cron failures** | SLA tick, retention, notifications, etc. |
| **Token refresh failures** | Integration credential refresh |
| **Dead-letter growth** | Raw events, integration dead letters |
| **Failed login spikes** | Unusual auth failure volume |
| **Forbidden access attempts** | 403 patterns; possible probing |
| **Service-role failure patterns** | Unexpected privileged errors |
| **Health endpoint** | Degradation trends; `/api/health` |

---

## Alert classification (required)

For each alert or alert type, explicitly classify:

| Classification | Action |
|----------------|--------|
| **Keep as-is** | Working well |
| **Tune** | Adjust threshold, routing, or message |
| **Remove** | No longer relevant |
| **Replace** | Rework alert logic or source |

Document decisions. Alerts left "as-is" without review become technical debt.

---

## Evidence

Create `evidence/monitoring/YYYY-MM-monitoring-review.md` with:

- Date, reviewer
- Weekly findings summary
- Monthly findings (coverage, noise, scrubbing)
- Alert classification decisions
- Follow-up actions
