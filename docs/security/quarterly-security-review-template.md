# Quarterly security operating review template

**Purpose:** Give leadership and owners a formal cadence for reviewing the health of the security program.

**Owner:** Founder / Admin  
**Cadence:** Quarterly (within first 3 weeks of new quarter)  
**Evidence:** `evidence/quarterly/YYYY-QX-security-review.md`

---

## Review topics (required)

For each quarter, review and document:

### 1. Control health summary

- How many controls are Healthy / Due soon / Overdue / Exception / Failed?
- Reference: [`control-health-register.md`](control-health-register.md)

### 2. Overdue controls

- List any overdue controls
- Root cause (resourcing, process, tooling)?
- Remediation plan

### 3. Incidents from the quarter

- Count and severity breakdown
- Any SEV-1/2? Postmortems completed?
- Trends or patterns

### 4. Restore drill outcomes

- Last full restore drill: pass/fail?
- Any remediation from failed drill?

### 5. Access review trends

- Removals? Stale access found?
- Any repeated issues?

### 6. Service-role usage trends

- New privileged call sites?
- Any unexpected patterns?
- Inventory still accurate?

### 7. Vendor/subprocessor changes

- New vendors added?
- Subprocessor list updated?
- Any vendor incidents?

### 8. Open remediation items

- Count by severity
- Oldest open item
- Blockers

### 9. Major security-related roadmap needs

- Tooling, headcount, process improvements
- Budget or priority decisions

---

## Attendees

- [ ] Founder / Admin
- [ ] Engineering Lead
- [ ] Operations Owner
- [ ] Incident Lead
- [ ] Vendor / Policy Owner (or delegate)

---

## Output

Store completed review in `evidence/quarterly/YYYY-QX-security-review.md` with:

- Date, attendees
- Summary of each topic
- Action items with owners and dates
