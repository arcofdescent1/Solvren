# Incident response policy

**Applies to:** Security incidents, privacy-impacting events, and major availability failures affecting Solvren or customer data.

**Owner:** Incident Lead — see [`../security-ownership.md`](../security-ownership.md).

**Related controls:** IR-01–IR-04 in [`../control-matrix.md`](../control-matrix.md).  
**Runbook:** [`../incident-response-runbook.md`](../incident-response-runbook.md).

---

## 1. Purpose

Define what constitutes an incident, how incidents are classified, who responds, how we communicate, and what documentation is required.

---

## 2. What counts as an incident

An **incident** is an event that:

- **Compromises** or risks compromise of confidentiality, integrity, or availability of customer data or Solvren production systems; or
- Causes **sustained production outage** or **material degradation** of core product use; or
- Represents a **confirmed or suspected** security vulnerability exploitation, credential leak, or misconfiguration with customer impact potential.

**Non-incidents** (typically): single user bugs, minor UI defects, planned maintenance (if communicated), local dev issues — unless they indicate a broader control failure.

---

## 3. Severity levels

| Level | Description (summary) |
|-------|------------------------|
| **SEV-1** | Active data exposure; cross-tenant data risk; critical auth failure; core production outage |
| **SEV-2** | Major integration failure; sustained alerting gap; major job failures with broad customer impact |
| **SEV-3** | Isolated customer impact with workaround; degraded non-core functionality |
| **SEV-4** | Low risk, minor defect, low urgency |

Full definitions and examples: [`../incident-response-runbook.md`](../incident-response-runbook.md).

---

## 4. Response ownership

- **Incident Lead** coordinates triage, severity, containment, and communication checklist (may be Engineering Lead or on-call).
- **Executive / founder** is informed for **SEV-1** and **SEV-2** as early as practical.
- **Customer communication** for material incidents is drafted by Incident Lead and reviewed by leadership before broad send (unless emergency template applies).

---

## 5. Communication expectations

- **Internal:** Use agreed channel (e.g., Slack + incident doc) for timeline, decisions, and handoffs.
- **Customers:** Notify when **personal data** or **material service** impact occurs, per contractual/regulatory obligations and severity.
- **Post-incident summary:** Owner assigns; **SEV-1/SEV-2** require **post-incident review** (postmortem) with actions and owners.

---

## 6. Documentation requirements

Every incident must capture:

- Detection and timeline  
- Severity and scope  
- Containment and remediation steps  
- Customer impact (if any)  
- Owner(s)  
- **Lessons learned** and **follow-up tasks** (for SEV-1/2 mandatory)

Evidence location: [`../evidence/incidents/`](../evidence/incidents/) (see [`../evidence/README.md`](../evidence/README.md)).

---

## 7. Review

This policy is reviewed **at least annually** and after every **SEV-1**. Run **tabletop exercises** per Phase 2 validation guidance.
