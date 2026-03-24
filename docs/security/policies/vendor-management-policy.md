# Vendor management policy

**Applies to:** Third-party services that process, store, or transmit Solvren or customer data, or are critical to production availability.

**Owner:** Vendor / Policy Owner — see [`../security-ownership.md`](../security-ownership.md).

**Related:** [`../vendor-inventory.md`](../vendor-inventory.md), [`../subprocessors.md`](../subprocessors.md), controls VT-* in [`../control-matrix.md`](../control-matrix.md).

---

## 1. Purpose

Identify critical vendors, define review before adoption, document subprocessors, and set minimum security expectations for vendors touching customer data.

---

## 2. Critical vendors

**Critical vendors** are those where failure or misuse could:

- Cause **material outage** of Solvren production, or  
- Lead to **unauthorized access** to customer data, or  
- Process **Confidential** or **Highly confidential** data (see data-handling policy).

Critical vendors are listed in [`../vendor-inventory.md`](../vendor-inventory.md) with an assigned **internal owner**.

---

## 3. Before adopting a new vendor

Before production use, complete at minimum:

1. **Purpose** and **data touched** (classification).
2. **Security / privacy** review: link to trust page, SOC 2 / ISO status if applicable, DPA availability.
3. **Subprocessor** update if customer data flows to the vendor — update [`../subprocessors.md`](../subprocessors.md) and customer-facing materials as required by contract.
4. **Owner** assignment in vendor inventory.
5. **Access model:** how Solvren authenticates, where secrets live, and who can access vendor admin UI.

**Emergency adoption** (incident tooling): document retroactively within **5 business days** in vendor inventory.

---

## 4. Subprocessor documentation

- Customer-facing **subprocessor list** is maintained in [`../subprocessors.md`](../subprocessors.md) (simplified) and kept consistent with the internal inventory.
- Material changes (new subprocessor, change of data role) follow **contractual** notice requirements.

---

## 5. Minimum security expectations (customer data)

Vendors that store or process **customer tenant data** or **credentials** should meet or be progressing toward:

- **Encryption in transit** (TLS) and **encryption at rest** where data is persisted  
- **Logical isolation** or contract commitments appropriate to multi-tenant SaaS  
- **Incident notification** commitments where available  
- **SOC 2 Type II** or equivalent **or** transparent security documentation for early-stage vendors (risk accepted by leadership)

Gaps are **documented** with **compensating controls** (e.g., extra encryption at app layer, limited data sent).

---

## 6. Review cadence

- **Quarterly:** Inventory accuracy and owner check.  
- **Annual:** Deeper review of critical vendors (certification status, incident history, contract renewal).

---

## 7. Review

This policy is reviewed **at least annually** or when privacy regime or customer contract template changes.
