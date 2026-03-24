# Vendor review checklist

**Purpose:** Ensure external trust dependencies (vendors, subprocessors) remain acceptable and documented.

**Owner:** Vendor / Policy Owner  
**Cadence:** Quarterly (formal); Monthly (dependency vulns only)  
**Evidence:** `evidence/vendors/YYYY-QX-vendor-review.md`; `evidence/dependencies/YYYY-MM-dependency-review.md` (for vulns)

---

## Vendor review scope (quarterly)

For each critical provider in [`vendor-inventory.md`](vendor-inventory.md):

- [ ] **Still in use?** — Active in production path
- [ ] **Still approved?** — No unresolved concerns
- [ ] **Any material incident or change?** — Vendor breach, terms change, etc.
- [ ] **Still matches internal inventory?** — Purpose, data, owner correct
- [ ] **Customer data exposure changed?** — New data flows? New subprocessors?
- [ ] **Security documentation link still current?** — Trust center, SOC report, etc.

---

## Dependency review scope (monthly)

For application dependencies (npm, etc.):

- [ ] **Critical/high vulnerabilities** — Dependabot, npm audit, Snyk
- [ ] **Upgrade urgency** — Exploitable? In production path?
- [ ] **Exploitability assessment** — Is the vuln reachable?
- [ ] **Deferred risks** — If not fixing now, document as exception in [`exception-management.md`](exception-management.md) or [`security-remediation-register.md`](security-remediation-register.md)

---

## New vendor check

Before adding a new production vendor:

- [ ] Purpose and data touched documented
- [ ] Security/privacy review (trust page, SOC/ISO if applicable)
- [ ] Subprocessor update if customer data flows
- [ ] Owner assigned in vendor inventory

---

## Evidence

- **Quarterly vendor:** `evidence/vendors/YYYY-QX-vendor-review.md`
- **Monthly dependencies:** `evidence/dependencies/YYYY-MM-dependency-review.md`
