# Incident response runbook

**Purpose:** Practical workflow for **detecting**, **triaging**, **containing**, and **recovering** from incidents; aligns with [`policies/incident-response-policy.md`](policies/incident-response-policy.md).

**Owner:** Incident Lead (first responder may be on-call engineer).

**Evidence:** [`evidence/incidents/`](evidence/incidents/) — one file per material incident.

---

## 1. Severity model

### SEV-1 (critical)

- **Active or confirmed** exposure of sensitive customer data  
- **Cross-tenant** data access or high likelihood  
- **Critical authentication** failure (bypass, universal session issue)  
- **Production outage** blocking core product use for many customers  

**Response:** All hands as needed; leadership notified **immediately**; customer comms plan within hours if data involved.

### SEV-2 (high)

- **Major integration** failure affecting many customers  
- **Sustained alerting** or monitoring blind spot for production  
- **Major job/workflow** failures with broad customer impact  

**Response:** Incident Lead owns; leadership notified **same day**; customer comms if material.

### SEV-3 (medium)

- **Isolated customer** issue with **workaround**  
- **Degraded non-core** functionality  

**Response:** Track in ticket; communicate to affected customer as appropriate; postmortem optional unless trend.

### SEV-4 (low)

- Minor defect, low urgency, no material security or availability impact  

**Response:** Normal bug workflow.

---

## 2. Incident workflow (required steps)

1. **Detection** — alert, customer report, internal find; note time (UTC).  
2. **Triage** — confirm real vs false positive; gather logs (no secrets in shared channels).  
3. **Severity assignment** — use section 1; escalate if uncertain upward.  
4. **Containment** — stop bleeding: revoke tokens, disable route, scale, feature flag, IP block, etc.  
5. **Remediation** — root fix or temporary mitigation with follow-up issue.  
6. **Communication** — internal timeline; external per policy and legal.  
7. **Recovery validation** — confirm metrics, spot-check tenants, monitor after deploy.  
8. **Post-incident review** — **mandatory for SEV-1 and SEV-2**; recommended for recurring SEV-3.

---

## 3. Communication rules

| Question | Guidance |
|----------|----------|
| **Who gets paged internally?** | On-call engineer + Incident Lead; SEV-1 adds founder/executive |
| **When leadership?** | SEV-1 immediately; SEV-2 same business day |
| **When customers?** | When material impact to **service** or **data**; align with contracts/DPA |
| **Who writes summary?** | Incident Lead drafts; leadership reviews before broad customer send |

Use a single **incident doc** or thread for decisions to avoid conflicting narratives.

---

## 4. Evidence after the incident

Create or update `evidence/incidents/YYYY-MM-DD-short-slug.md` with:

- Timeline (UTC)  
- Impact (customers, data types)  
- Actions taken (containment, remediation)  
- Owner(s)  
- Lessons learned  
- Follow-up actions with owners and dates  

---

## 5. Tabletop exercises (recommended)

At least annually:

- Simulated **credential leak**  
- Simulated **restore** from backup  
- Simulated **access review** miss (orphan admin)  

Capture outcomes in `evidence/incidents/` or `evidence/monitoring/` as **drill records** (not customer incidents).

---

## 6. Contacts

| Role | Name / handle | Primary channel |
|------|----------------|-----------------|
| Incident Lead | [Your Name] | [e.g. Slack #incidents, email] |
| Engineering Lead | [Your Name] | [e.g. Slack DM, email] |
| Executive | [Your Name] | [e.g. email, phone for SEV-1] |

**Update when staffing changes.** Replace bracketed placeholders with actual names and channels.
