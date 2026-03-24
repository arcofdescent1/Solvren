# Exception management process

**Purpose:** Define what happens when a control cannot be met on time or must be temporarily bypassed. No indefinite exceptions.

**Owner:** Vendor / Policy Owner (process); individual owners per exception (approval)  
**Related:** [`control-operations-calendar.md`](control-operations-calendar.md), [`control-health-register.md`](control-health-register.md)

---

## Rule: no indefinite exceptions

Every exception must:

- **Expire** on a set date, or
- **Be renewed explicitly** with new expiration, or
- **Be closed** when the underlying gap is remediated

---

## Exception record (required fields)

For each exception, record:

| Field | Required | Description |
|-------|----------|-------------|
| **Exception ID** | Yes | Format: `EXC-YYYY-MM-NN` (e.g. EXC-2026-03-01) |
| **Control affected** | Yes | Control ID or name from calendar/matrix |
| **Reason** | Yes | Why the exception is needed |
| **Risk introduced** | Yes | Brief description of risk during exception |
| **Compensating controls** | Yes | What mitigates the risk temporarily |
| **Owner** | Yes | Person responsible for closure or renewal |
| **Approver** | Yes | Who approved (e.g. Engineering Lead, Founder) |
| **Start date** | Yes | When exception took effect |
| **Expiration date** | Yes | When exception expires (max 90 days typical) |
| **Closure criteria** | Yes | What must be true to close (e.g. "Access review completed") |
| **Status** | Yes | Open | Renewed | Closed |

---

## Exception register

| ID | Control | Reason | Risk | Compensating | Owner | Approver | Start | Expires | Status |
|----|---------|--------|------|--------------|-------|----------|-------|---------|--------|
| *None* | | | | | | | | | |

*Add rows when exceptions are approved. Move to Closed when criteria met; or Renew with new expiration.*

---

## Valid exception examples

| Scenario | Example | Max typical duration |
|----------|---------|----------------------|
| Restore drill delayed | Production incident response; restore drill postponed | 30 days |
| Emergency hotfix | Post-review required; exception for expedited merge | 5 business days |
| Vendor approval pending | New vendor in use; security review documentation pending | 60 days |
| Short-lived privileged access | Urgent investigation; break-glass access | 7 days |
| Dependency remediation deferred | Critical CVE; mitigation in place; upgrade scheduled | 30 days |

---

## Process

1. **Request:** Owner documents exception with all required fields.
2. **Approve:** Approver (Engineering Lead, Founder, or delegate) reviews risk and compensating controls; approves or rejects.
3. **Record:** Add to exception register; update control health register status to "Exception approved."
4. **Monitor:** Owner tracks expiration; closes or renews before expiry.
5. **Renewal:** If renewal needed, document reason; set new expiration; get re-approval. Maximum 2 renewals without leadership review.
6. **Closure:** When criteria met, set Status = Closed; update control health to Healthy.

---

## Escalation

- **Expired without closure:** Escalate to Founder / Admin; treat as control failure; add to remediation register.
- **Repeated exceptions for same control:** Root-cause analysis; update process or calendar if cadence is unrealistic.
