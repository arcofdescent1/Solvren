# Control operations calendar

**Purpose:** Assign a real cadence to each major security control so that controls are actively run, routinely verified, and continuously evidenced.

**Owner:** Operations Owner  
**Related:** [`control-matrix.md`](control-matrix.md), [`control-health-register.md`](control-health-register.md), [`evidence/evidence-operations.md`](evidence/evidence-operations.md)

---

## Cadence legend

| Field | Meaning |
|-------|---------|
| **Evidence artifact** | File or record produced |
| **Completion method** | How the control is executed |
| **Escalation** | What happens if missed |

---

## Daily controls

| Control name | Cadence | Owner | Evidence artifact | Completion method | Escalation if missed |
|--------------|---------|-------|-------------------|-------------------|----------------------|
| Health endpoint review | Daily | Engineering Lead | Monitoring dash / logs | Check `/api/health` response; alert on degradation | Incident if prolonged; log in monitoring review |
| Failed job / dead-letter review | Daily | Engineering Lead | Admin UI or logs | Review dead-letter counts; triage failures | Include in weekly privileged usage review; escalate if backlog grows |
| Critical alert review | Daily | Incident Lead | Sentry / alert inbox | Triage page/urgent alerts | Incident runbook; leadership notified per severity |
| Integration credential failure review | Daily | Engineering Lead | Integration health / logs | Spot-check token refresh failures | Include in weekly review; exception if known outage |

---

## Weekly controls

| Control name | Cadence | Owner | Evidence artifact | Completion method | Escalation if missed |
|--------------|---------|-------|-------------------|-------------------|----------------------|
| Privileged service-role usage review | Weekly | Engineering Lead | Audit queries / logs | Sample privileged actions; confirm expected callers | Add to monthly access review; remediation if drift |
| Failed login / forbidden access anomaly review | Weekly | Engineering Lead | Auth logs / Sentry | Check for spikes or patterns | Incident if attack pattern; tune auth logging |
| Change-management spot check | Weekly | Engineering Lead | Release log sample | Confirm recent deploys have PR links | Include in monthly change verification |
| Open security exceptions review | Weekly | Vendor / Policy Owner | [`security-remediation-register.md`](security-remediation-register.md) | Review open items; nudge owners | Escalate overdue items to leadership |

---

## Monthly controls

| Control name | Cadence | Owner | Evidence artifact | Completion method | Escalation if missed |
|--------------|---------|-------|-------------------|-------------------|----------------------|
| Production/admin access review | Monthly | Operations Owner | `evidence/access-reviews/YYYY-MM.md` | [`access-review-checklist.md`](access-review-checklist.md) | Escalate by day 10 of next month |
| Backup restore drill or validation | Monthly | Operations Owner | `evidence/backups/YYYY-MM-backup-validation.md` | [`backup-validation-checklist.md`](backup-validation-checklist.md) | Incident or remediation ticket if failed |
| Dependency vulnerability review | Monthly | Engineering Lead | `evidence/dependencies/YYYY-MM-dependency-review.md` | [`vendor-review-checklist.md`](vendor-review-checklist.md) dep scope | Remediation register; expedite critical |
| Vendor/service dependency status review | Monthly | Vendor / Policy Owner | Vendor inventory update | Spot-check critical vendors still in use | Quarterly formal review covers gaps |
| Retention job verification | Monthly | Engineering Lead | `evidence/monitoring/` or cron logs | Confirm retention sweep ran; check job success | Remediation if job failed; legal review if backlog |
| Audit logging completeness spot check | Monthly | Engineering Lead | `evidence/monitoring/YYYY-MM-audit-log-review.md` | [`audit-review-checklist.md`](audit-review-checklist.md) | Remediation for gaps |
| Change verification | Monthly | Engineering Lead | `evidence/releases/YYYY-MM-change-verification.md` | [`change-verification-checklist.md`](change-verification-checklist.md) | Remediation if drift; SDLC update |
| Monitoring review | Monthly | Engineering Lead | `evidence/monitoring/YYYY-MM-monitoring-review.md` | [`monitoring-review-checklist.md`](monitoring-review-checklist.md) | Tune alerts; escalate if blind spots |

---

## Quarterly controls

| Control name | Cadence | Owner | Evidence artifact | Completion method | Escalation if missed |
|--------------|---------|-------|-------------------|-------------------|----------------------|
| Incident response tabletop | Quarterly | Incident Lead | `evidence/quarterly/YYYY-QX-incident-tabletop.md` | Simulate incident; document outcome | Schedule make-up within 30 days |
| Policy and control matrix review | Quarterly | Vendor / Policy Owner | Control matrix diff / notes | Review policies; update control matrix | Annual policy review catches gaps |
| Subprocessor/vendor inventory review | Quarterly | Vendor / Policy Owner | `evidence/vendors/YYYY-QX-vendor-review.md` | [`vendor-review-checklist.md`](vendor-review-checklist.md) | Add to remediation if new vendor undocumented |
| Security ownership review | Quarterly | Founder / Admin | [`security-ownership.md`](security-ownership.md) | Confirm owners still correct; reassign if needed | Update on hire/departure |
| Disaster recovery readiness review | Quarterly | Operations Owner | Quarterly review doc | Restore drill; backup config; RTO/RPO check | Remediation for gaps |
| Quarterly security operating review | Quarterly | Founder / Admin | `evidence/quarterly/YYYY-QX-security-review.md` | [`quarterly-security-review-template.md`](quarterly-security-review-template.md) | Schedule within 2 weeks of quarter end |

---

## Full restore drill (quarterly)

| Control name | Cadence | Owner | Evidence artifact | Completion method | Escalation if missed |
|--------------|---------|-------|-------------------|-------------------|----------------------|
| Full non-production restore drill | Quarterly | Operations Owner | `evidence/backups/YYYY-QX-restore-drill.md` | Full restore per [`restore-test-checklist.md`](restore-test-checklist.md) | Incident; remediation with target date |

---

## Scheduling

- **Daily:** Automated alerts + manual triage; no separate evidence file required unless incident.
- **Weekly:** Short review; findings feed monthly evidence or remediation register.
- **Monthly:** Complete by **5th business day** of the following month (e.g., March evidence by ~April 7).
- **Quarterly:** Complete within **first 3 weeks** of new quarter (e.g., Q1 review by mid-April).

---

## Related

- [`control-health-register.md`](control-health-register.md) — Track last completed / next due / status
- [`exception-management.md`](exception-management.md) — When a control cannot be met on time
