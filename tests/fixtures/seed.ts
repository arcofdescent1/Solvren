/**
 * Pass 5 UAT seed data — shared with E2E tests.
 * Run `npm run seed` before E2E. Tests rely on deterministic seeded state.
 */

export const UAT_PASSWORD = process.env.UAT_SEED_PASSWORD ?? "UAT-Pass5-Demo!";

export const PERSONAS = {
  owner: { email: "owner@uat.solvren.test", displayName: "Olivia Owner" },
  admin: { email: "admin@uat.solvren.test", displayName: "Adam Admin" },
  submitter: { email: "submitter@uat.solvren.test", displayName: "Sophie Submitter" },
  reviewer: { email: "reviewer@uat.solvren.test", displayName: "Riley Reviewer" },
  viewer: { email: "viewer@uat.solvren.test", displayName: "Victor Viewer" },
  finance: { email: "finance@uat.solvren.test", displayName: "Fiona Finance" },
  security: { email: "security@uat.solvren.test", displayName: "Sam Security" },
  restricted: { email: "restricted@uat.solvren.test", displayName: "Renee Restricted" },
} as const;

export const ORG_NAME = "Acme Revenue Ops";

export const CHANGE_IDS = {
  PRICING_HIGH_RISK: "11111111-1111-5000-8000-000000000001",
  BILLING_BLOCKED: "11111111-1111-5000-8000-000000000002",
  REVENUE_RECOGNITION_APPROVED: "11111111-1111-5000-8000-000000000003",
  LEAD_ROUTING: "11111111-1111-5000-8000-000000000004",
  RESTRICTED_SECURITY: "11111111-1111-5000-8000-000000000005",
  OVERDUE_APPROVAL: "11111111-1111-5000-8000-000000000006",
  DRAFT_IN_PROGRESS: "11111111-1111-5000-8000-000000000007",
  REJECTED_REVISED: "11111111-1111-5000-8000-000000000008",
} as const;

export const CHANGE_TITLES = {
  PRICING_HIGH_RISK: "Stripe Pricing Logic Update",
  BILLING_BLOCKED: "Billing Reconciliation Patch",
  REVENUE_RECOGNITION_APPROVED: "Q1 Revenue Recognition Rule Update",
  RESTRICTED_SECURITY: "Security Review for Billing Auth Hardening",
  LEAD_ROUTING: "HubSpot to Salesforce Lead Routing Sync",
  OVERDUE_APPROVAL: "NetSuite Chart of Accounts Update",
} as const;
