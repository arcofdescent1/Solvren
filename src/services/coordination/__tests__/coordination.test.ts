import { describe, expect, test } from "vitest";
import { buildCoordinationInputHash } from "../buildCoordinationInput";
import { generateCoordinationPlan } from "../generateCoordinationPlan";
import type { CoordinationInput } from "../coordinationTypes";

function baseInput(overrides?: Partial<CoordinationInput>): CoordinationInput {
  return {
    inputHash: "x",
    change: {
      id: "c1",
      orgId: "o1",
      title: "Pricing update",
      description: "Update pricing rules",
      changeType: "Pricing",
      domain: "Finance",
      systems: ["Stripe"],
      revenueImpactArea: ["BILLING"],
      customerImpact: true,
      rolloutMethod: "Immediate",
      backfillRequired: true,
      status: "READY",
      authorId: "owner-1",
      visibility: null,
      isRestricted: false,
      evidenceItems: [],
      approvers: [],
    },
    org: {
      approvalMappings: [
        {
          triggerType: "DOMAIN",
          triggerValue: "Finance",
          roleId: "r-fin",
          roleName: "Finance Reviewer",
          enabled: true,
          priority: 100,
        },
        {
          triggerType: "SYSTEM",
          triggerValue: "Stripe",
          roleId: "r-bill",
          roleName: "Billing Owner",
          enabled: true,
          priority: 90,
        },
      ],
      roleMembers: [
        {
          roleId: "r-fin",
          roleName: "Finance Reviewer",
          userId: "u-fin",
          email: null,
          name: "Fin User",
          canReview: true,
        },
        {
          roleId: "r-bill",
          roleName: "Billing Owner",
          userId: "u-bill",
          email: null,
          name: "Bill User",
          canReview: true,
        },
      ],
      notificationSettings: {
        emailEnabled: true,
        notificationEmails: ["finance@example.com"],
        slackEnabled: true,
        slackDefaultChannelId: "C123",
      },
    },
    ...overrides,
  };
}

describe("buildCoordinationInputHash", () => {
  test("is stable for same input", () => {
    const payload = {
      change: { changeType: "Pricing", domain: "Finance", systems: ["Stripe"] },
      mappingSignature: [{ trigger: "DOMAIN", value: "Finance" }],
      roleSignature: [{ role: "Finance Reviewer", members: ["u1"] }],
      notificationSignature: { emailEnabled: true },
    };
    const a = buildCoordinationInputHash(payload);
    const b = buildCoordinationInputHash(payload);
    expect(a).toBe(b);
  });

  test("changes when material field changes", () => {
    const a = buildCoordinationInputHash({
      change: { changeType: "Pricing", domain: "Finance", systems: ["Stripe"] },
      mappingSignature: [],
      roleSignature: [],
      notificationSignature: {},
    });
    const b = buildCoordinationInputHash({
      change: { changeType: "Billing Logic", domain: "Finance", systems: ["Stripe"] },
      mappingSignature: [],
      roleSignature: [],
      notificationSignature: {},
    });
    expect(a).not.toBe(b);
  });
});

describe("generateCoordinationPlan", () => {
  test("finance + stripe + pricing returns merged approver set and evidence", () => {
    const plan = generateCoordinationPlan(baseInput());
    expect(plan.approvals.suggestedApprovers.length).toBeGreaterThanOrEqual(2);
    expect(plan.evidence.requiredItems.some((e) => e.kind === "REVENUE_VALIDATION")).toBe(true);
    expect(plan.evidence.requiredItems.some((e) => e.kind === "BACKFILL_VALIDATION")).toBe(true);
  });

  test("dedupes approvers and excludes unauthorized members", () => {
    const input = baseInput({
      org: {
        ...baseInput().org,
        roleMembers: [
          {
            roleId: "r-fin",
            roleName: "Finance Reviewer",
            userId: "u-fin",
            email: null,
            name: null,
            canReview: true,
          },
          {
            roleId: "r-bill",
            roleName: "Billing Owner",
            userId: "u-fin",
            email: null,
            name: null,
            canReview: true,
          },
          {
            roleId: "r-fin",
            roleName: "Finance Reviewer",
            userId: "u-no",
            email: null,
            name: null,
            canReview: false,
          },
        ],
      },
    });
    const plan = generateCoordinationPlan(input);
    expect(plan.approvals.suggestedApprovers.filter((a) => a.userId === "u-fin").length).toBe(2);
    expect(plan.approvals.suggestedApprovers.some((a) => a.userId === "u-no")).toBe(false);
  });

  test("restricted changes avoid broad channel suggestions", () => {
    const plan = generateCoordinationPlan(
      baseInput({
        change: {
          ...baseInput().change,
          isRestricted: true,
        },
      })
    );
    expect(plan.notifications.suggestedRecipients.some((r) => r.channel === "EMAIL")).toBe(false);
    expect(plan.notifications.suggestedRecipients.some((r) => r.channel === "SLACK")).toBe(false);
  });
});
