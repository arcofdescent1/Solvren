# Solvren — Beta Onboarding and Pilot Framework

How beta organizations start using the product and what success looks like.

---

## Table of Contents

1. [Beta Onboarding Process](#1-beta-onboarding-process)
2. [Pilot Use Cases](#2-pilot-use-cases)
3. [Beta Success Criteria](#3-beta-success-criteria)
4. [Beta Feedback Areas](#4-beta-feedback-areas)

---

## 1. Beta Onboarding Process

### Step 1 — Organization Setup

1. **Create organization** — Provision org for the beta partner
2. **Invite key stakeholders** — Owner, Admin, Submitters, Reviewers
3. **Verify access** — Ensure all can log in and see the right surfaces

**Checklist:**

- [ ] Org created
- [ ] Admin/Owner invited
- [ ] At least one Submitter and one Reviewer invited
- [ ] Login and access confirmed

### Step 2 — Governance Configuration

1. **Configure domains** — Enable domains (e.g., REVENUE, SECURITY) that match the partner's workflows
2. **Configure approval roles** — Create roles (Finance Reviewer, Billing Owner, etc.) and assign users
3. **Configure approval mappings** — Map domains, systems, and change types to approval roles

**Example mapping:**

| Trigger Type | Trigger Value | Approval Role |
|--------------|---------------|---------------|
| DOMAIN | REVENUE | Finance Reviewer |
| SYSTEM | Stripe | Billing Owner |
| CHANGE_TYPE | PRICING | Revenue Leadership |

**Checklist:**

- [ ] Domains enabled
- [ ] Approval roles created and populated
- [ ] Approval mappings configured for pilot use cases
- [ ] Domain permissions set for reviewers

### Step 3 — Pilot Use Case Selection

Choose one or two high-impact workflows to pilot. See [Pilot Use Cases](#2-pilot-use-cases) below.

### Step 4 — First Change

1. Have a Submitter create the first real change through guided intake
2. Generate coordination plan and apply approvers/evidence
3. Submit for review
4. Have Reviewer approve
5. Confirm end-to-end flow works for the partner

---

## 2. Pilot Use Cases

Select one or two for the beta:

| Use Case | Description | Why It Works |
|----------|-------------|--------------|
| **Pricing changes** | Stripe, Chargebee, or other pricing logic updates | High risk, clear stakeholders, strong ROI story |
| **Billing logic changes** | Invoice generation, subscription lifecycle, proration | Finance + Billing Owner involvement, evidence-heavy |
| **Revenue recognition updates** | NetSuite, ERP, or reporting rule changes | Critical for compliance, clear audit need |
| **Integration changes** | Webhooks, API, CRM sync | Multi-system coordination, risk visibility |
| **Schema / data changes** | CRM field changes, data migration | Data integrity risk, stakeholder clarity |

**Recommended:** Start with **pricing** or **billing logic** changes—they have clear risk and stakeholder alignment.

---

## 3. Beta Success Criteria

A pilot is **successful** when:

1. **Teams submit real changes** — At least 3–5 changes submitted through the system during the pilot
2. **Coordination autopilot reduces manual coordination** — Partners report less back-and-forth to figure out approvers/evidence
3. **Revenue Impact Reports are reviewed** — Reviewers use reports to inform decisions
4. **Approval governance is followed** — Changes are approved through the system with traceability

**Quantitative indicators:**

- Number of changes submitted
- Number of approvals completed
- Time from submission to approval (qualitative)
- Feedback score on coordination usefulness

**Qualitative indicators:**

- Partner can run the flow without heavy support
- Executives find dashboards useful
- Partners want to expand beyond the pilot use case

---

## 4. Beta Feedback Areas

Collect structured feedback on:

| Area | Questions |
|------|-----------|
| **Usability** | Is the UI intuitive? Where do users get stuck? |
| **Workflow clarity** | Are intake steps clear? Is the approval flow logical? |
| **Report usefulness** | Do Revenue Impact Reports help? What's missing? |
| **Search quality** | Can users find changes and systems quickly? |
| **Dashboard visibility** | Do executives get value from the Executive and Dashboard views? |
| **Coordination autopilot** | Are suggestions relevant? What would improve them? |
| **Evidence enforcement** | Are evidence requirements reasonable? Too strict or too loose? |

**Feedback format:**

- Weekly sync during pilot
- Short survey at pilot midpoint and end
- Bug reports and enhancement requests tracked separately

---

## Beta Program Timeline (Example)

| Phase | Duration | Activities |
|-------|----------|------------|
| **Kickoff** | Week 1 | Org setup, governance config, pilot use case selection |
| **Pilot** | Weeks 2–6 | Real changes submitted and approved; feedback collected |
| **Review** | Week 7 | Success criteria review, feedback synthesis, next steps |

---

## See Also

- [USER_GUIDE.md](./USER_GUIDE.md) — Product usage
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) — Governance configuration
- [UAT_SEED_DATA.md](./UAT_SEED_DATA.md) — Demo environment and personas
