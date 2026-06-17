# Solvren Beta Onboarding and Pilot Framework

How beta organizations start using Solvren and what success looks like.

Last updated: 2026-06-17

---

## 1. Beta Onboarding Process

### Step 1 - Organization Setup

1. Create the organization.
2. Confirm the primary owner and admin.
3. Invite the first decision makers.
4. Confirm everyone can log in and see the expected workspace.

Checklist:

- [ ] Org created
- [ ] Owner/admin invited
- [ ] Finance, RevOps, engineering, and reviewer stakeholders identified
- [ ] Login and access confirmed
- [ ] Users encouraged to add profile pictures for easier ownership scanning

### Step 2 - Connect Systems

Connect the systems needed for the first pilot workflow.

Common beta systems:

- Stripe or billing
- Salesforce or HubSpot
- Jira or GitHub
- NetSuite or finance
- data warehouse or operational database

Checklist:

- [ ] First system connected
- [ ] Connection health reviewed
- [ ] Setup health visible in Home or Setup
- [ ] Any connection needing attention has an owner

### Step 3 - Choose What To Protect

Choose one or two workflows where the value will be obvious.

Recommended starting workflows:

- pricing changes
- billing logic
- invoice or renewal workflows
- lead routing
- CRM or billing integration changes
- revenue recognition changes

### Step 4 - Configure Decision Rules

Configure only the rules needed for the pilot:

- approval roles
- approval mappings
- proof expectations
- domain permissions
- attention routing

Avoid over-configuring before the product has shown value.

### Step 5 - Run The First Decision Or Problem

For a change-review pilot:

1. Create the first real revenue-sensitive change.
2. Add business impact and proof.
3. Submit for review.
4. Have the assigned reviewer decide.
5. Download or review the proof packet.

For a problem-detection pilot:

1. Connect the system.
2. Confirm the first problem appears.
3. Assign an owner.
4. Resolve or verify the problem.
5. Confirm Proof reflects the value story.

---

## 2. Pilot Use Cases

| Use Case | Description | Why It Works |
|----------|-------------|--------------|
| Pricing changes | Stripe, Chargebee, or other pricing logic updates | High risk, clear stakeholders, strong proof story |
| Billing logic | Invoice generation, subscription lifecycle, proration | Finance + engineering ownership, evidence-heavy |
| Revenue recognition | NetSuite, ERP, or reporting rule changes | Critical for audit and compliance |
| Integration changes | Webhooks, APIs, CRM sync | Multi-system coordination and high hidden-risk potential |
| Lead routing | CRM territory, assignment, or campaign routing | Easy for revenue leaders to understand |

Recommended: start with pricing, billing, or lead routing because the business value is immediately visible.

---

## 3. Beta Success Criteria

A pilot is successful when:

1. Users can explain Solvren in one sentence: what revenue is at risk, what needs action, and what value was protected.
2. Home gives a useful ten-second summary.
3. Decisions makes the next action obvious.
4. Problems show a clear owner and business impact.
5. Proof shows credible protected value.
6. Setup feels manageable, not overwhelming.

Quantitative indicators:

- number of connected systems
- number of decisions reviewed
- number of problems detected
- time from decision surfaced to action taken
- proof packets or value stories created

Qualitative indicators:

- executives understand the value without a long explanation
- finance and engineering agree on ownership
- reviewers trust the proof
- admins can configure the pilot without heavy support
- the customer wants to expand coverage

---

## 4. Feedback Areas

| Area | Questions |
|------|-----------|
| Value clarity | Is the value obvious on Home and Proof? |
| Decision clarity | Can users tell what to do next? |
| Problem clarity | Does each problem explain why it matters? |
| Setup clarity | Can admins connect systems and invite users without confusion? |
| Proof credibility | Would a VP, CEO, or board member trust the proof packet? |
| Terminology | Are any terms too internal or technical for the target user? |
| Consistency | Does the app feel uniform across roles and workflows? |

---

## 5. Beta Program Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Kickoff | Week 1 | Org setup, first systems, pilot workflow selection |
| First value | Weeks 1-2 | First decision, problem, proof packet, or value story |
| Expansion | Weeks 3-6 | Add workflows, users, and decision rules |
| Review | Week 7 | Success criteria review, feedback synthesis, next steps |

---

## See Also

- [USER_GUIDE.md](./USER_GUIDE.md)
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)
- [EXECUTIVE_GUIDE.md](./EXECUTIVE_GUIDE.md)
