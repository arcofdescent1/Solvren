import { coordinationPlanSchema } from "./coordinationSchema";
import { CRITICAL_CHANGE_TYPES, CRITICAL_SYSTEMS, DOMAIN_DEFAULT_REQUIRED } from "./approvalRules";
import {
  CHANGE_TYPE_EVIDENCE_RULES,
  DOMAIN_EVIDENCE_RULES,
  SYSTEM_EVIDENCE_RULES,
  type EvidenceRuleItem,
} from "./evidenceRules";
import { DOMAIN_NOTIFICATION_CHANNELS } from "./notificationRules";
import type { CoordinationInput, CoordinationPlan } from "./coordinationTypes";

function lower(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

function uniqBy<T>(items: T[], keyFn: (i: T) => string): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function mergeReasons(a: string, b: string): string {
  if (!a) return b;
  if (!b || a.includes(b)) return a;
  return `${a} ${b}`;
}

export function generateCoordinationPlan(input: CoordinationInput): CoordinationPlan {
  const domain = lower(input.change.domain);
  const changeType = lower(input.change.changeType);
  const systemsLower = input.change.systems.map(lower);

  const byRole = new Map<
    string,
    {
      role: string;
      source: "DOMAIN_MAPPING" | "SYSTEM_MAPPING" | "CHANGE_TYPE_MAPPING" | "MANUAL_RULE";
      reason: string;
      required: boolean;
      members: Array<{
        userId: string;
        displayName: string;
      }>;
    }
  >();

  const missingCoverage: CoordinationPlan["approvals"]["missingCoverage"] = [];

  const triggerMatches = input.org.approvalMappings.filter((m) => {
    if (!m.enabled) return false;
    if (m.triggerType === "DOMAIN") return lower(m.triggerValue) === domain;
    if (m.triggerType === "SYSTEM") return systemsLower.includes(lower(m.triggerValue));
    return changeType === lower(m.triggerValue);
  });

  const matchedByRole = new Map<string, typeof triggerMatches>();
  for (const m of triggerMatches) {
    const arr = matchedByRole.get(m.roleId) ?? [];
    arr.push(m);
    matchedByRole.set(m.roleId, arr);
  }

  for (const [roleId, matches] of matchedByRole.entries()) {
    const roleName = matches[0]?.roleName ?? "Unknown Role";
    const members = input.org.roleMembers.filter((rm) => rm.roleId === roleId && rm.canReview);
    const source = matches.some((m) => m.triggerType === "DOMAIN")
      ? "DOMAIN_MAPPING"
      : matches.some((m) => m.triggerType === "SYSTEM")
        ? "SYSTEM_MAPPING"
        : "CHANGE_TYPE_MAPPING";
    const reasons = matches
      .map((m) => `${m.triggerType.toLowerCase()} matched "${m.triggerValue}"`)
      .join("; ");

    if (members.length === 0) {
      missingCoverage.push({
        type:
          source === "DOMAIN_MAPPING"
            ? "DOMAIN"
            : source === "SYSTEM_MAPPING"
              ? "SYSTEM"
              : "CHANGE_TYPE",
        value: roleName,
        reason: `Role "${roleName}" is mapped but has no authorized members for this domain.`,
      });
      continue;
    }

    const existing = byRole.get(roleName);
    const users = members.map((m) => ({
      userId: m.userId,
      displayName: m.name ?? m.email ?? m.userId,
    }));
    if (!existing) {
      byRole.set(roleName, {
        role: roleName,
        source,
        reason: reasons,
        required: true,
        members: users,
      });
    } else {
      byRole.set(roleName, {
        ...existing,
        required: existing.required || true,
        reason: mergeReasons(existing.reason, reasons),
        members: uniqBy([...existing.members, ...users], (u) => u.userId),
      });
    }
  }

  if (input.change.backfillRequired) {
    const dataRoleMembers = input.org.roleMembers.filter(
      (m) => lower(m.roleName).includes("data reviewer") && m.canReview
    );
    if (dataRoleMembers.length === 0) {
      missingCoverage.push({
        type: "CHANGE_TYPE",
        value: "Data Reviewer",
        reason: "Backfill is required but no Data Reviewer role members were resolved.",
      });
    } else {
      byRole.set("Data Reviewer", {
        role: "Data Reviewer",
        source: "MANUAL_RULE",
        reason: "Backfill required changes require data reviewer coverage.",
        required: true,
        members: uniqBy(
          dataRoleMembers.map((m) => ({
            userId: m.userId,
            displayName: m.name ?? m.email ?? m.userId,
          })),
          (u) => u.userId
        ),
      });
    }
  }

  if (DOMAIN_DEFAULT_REQUIRED.has(domain) && !Array.from(byRole.values()).length) {
    missingCoverage.push({
      type: "DOMAIN",
      value: input.change.domain,
      reason: `No approver mappings resolved for governed domain ${input.change.domain}.`,
    });
  }

  for (const s of systemsLower) {
    if (CRITICAL_SYSTEMS.includes(s) && !triggerMatches.some((m) => m.triggerType === "SYSTEM" && lower(m.triggerValue) === s)) {
      missingCoverage.push({
        type: "SYSTEM",
        value: s,
        reason: `Critical system ${s} has no mapped approver coverage.`,
      });
    }
  }

  if (
    CRITICAL_CHANGE_TYPES.some((ct) => changeType.includes(ct)) &&
    !triggerMatches.some((m) => m.triggerType === "CHANGE_TYPE")
  ) {
    missingCoverage.push({
      type: "CHANGE_TYPE",
      value: input.change.changeType ?? "unknown",
      reason: "Critical change type has no mapped approver coverage.",
    });
  }

  const suggestedApprovers = uniqBy(
    Array.from(byRole.values()).flatMap((r) =>
      r.members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        role: r.role,
        source: r.source,
        required: r.required,
        reason: r.reason,
      }))
    ),
    (a) => `${a.userId}::${a.role}`
  );

  const evidenceRequired: EvidenceRuleItem[] = [];
  const evidenceRecommended: EvidenceRuleItem[] = [];
  const pushEvidence = (item: EvidenceRuleItem) => {
    if (item.required) evidenceRequired.push(item);
    else evidenceRecommended.push(item);
  };

  for (const [k, rules] of Object.entries(CHANGE_TYPE_EVIDENCE_RULES)) {
    if (changeType.includes(k)) rules.forEach(pushEvidence);
  }
  for (const sys of systemsLower) {
    (SYSTEM_EVIDENCE_RULES[sys] ?? []).forEach(pushEvidence);
  }
  (DOMAIN_EVIDENCE_RULES[domain] ?? []).forEach(pushEvidence);
  if (lower(input.change.rolloutMethod) === "immediate") {
    pushEvidence({
      kind: "HEIGHTENED_MONITORING",
      title: "Heightened monitoring plan",
      reason: "Immediate rollouts require stronger near-term monitoring.",
      source: "RISK_RULE",
      required: false,
    });
  }
  if (input.change.backfillRequired) {
    pushEvidence({
      kind: "BACKFILL_VALIDATION",
      title: "Backfill validation evidence",
      reason: "Backfill-required changes need reconciliation and validation artifacts.",
      source: "RISK_RULE",
      required: true,
    });
  }
  if (input.change.customerImpact) {
    pushEvidence({
      kind: "COMMS_PLAN",
      title: "Customer communication plan",
      reason: "Customer-impacting changes should include communication readiness.",
      source: "RISK_RULE",
      required: false,
    });
  }

  const requiredItems = uniqBy(
    evidenceRequired.map((e) => ({
      kind: e.kind,
      title: e.title,
      reason: e.reason,
      source: e.source,
    })),
    (e) => e.kind
  );
  const recommendedItems = uniqBy(
    evidenceRecommended
      .filter((e) => !requiredItems.some((r) => r.kind === e.kind))
      .map((e) => ({
        kind: e.kind,
        title: e.title,
        reason: e.reason,
        source: e.source,
      })),
    (e) => e.kind
  );

  const suggestedRecipients: CoordinationPlan["notifications"]["suggestedRecipients"] = [];
  suggestedRecipients.push({
    recipientType: "USER",
    recipientId: input.change.authorId ?? "change-owner",
    displayName: "Change Owner",
    channel: "IN_APP",
    reason: "Change owner needs ongoing coordination visibility.",
  });
  for (const a of suggestedApprovers) {
    suggestedRecipients.push({
      recipientType: "USER",
      recipientId: a.userId,
      displayName: a.displayName,
      channel: "IN_APP",
      reason: `Suggested approver for ${a.role}.`,
    });
  }
  const domainChannels = DOMAIN_NOTIFICATION_CHANNELS[domain] ?? [];
  for (const ch of domainChannels) {
    if (input.change.isRestricted && (ch.channel === "EMAIL" || ch.channel === "SLACK")) continue;
    if (ch.channel === "EMAIL" && input.org.notificationSettings.emailEnabled && input.org.notificationSettings.notificationEmails.length > 0) {
      suggestedRecipients.push({
        recipientType: "EMAIL_LIST",
        recipientId: "org-notification-emails",
        displayName: "Organization notification list",
        channel: "EMAIL",
        reason: ch.description,
      });
    }
    if (ch.channel === "SLACK" && input.org.notificationSettings.slackEnabled && input.org.notificationSettings.slackDefaultChannelId) {
      suggestedRecipients.push({
        recipientType: "SLACK_CHANNEL",
        recipientId: input.org.notificationSettings.slackDefaultChannelId,
        displayName: "Default Slack channel",
        channel: "SLACK",
        reason: ch.description,
      });
    }
  }

  const blockers: CoordinationPlan["blockers"] = [];
  for (const m of missingCoverage) {
    blockers.push({
      code: `MISSING_${m.type}_COVERAGE`,
      title: `Missing ${m.type.toLowerCase()} reviewer coverage`,
      description: m.reason,
      severity: m.type === "DOMAIN" || m.type === "SYSTEM" ? "ERROR" : "WARNING",
    });
  }

  const existingKinds = new Set(input.change.evidenceItems.map((e) => e.kind));
  const missingRequiredEvidenceKinds = requiredItems
    .map((e) => e.kind)
    .filter((k) => !existingKinds.has(k));
  if (missingRequiredEvidenceKinds.length > 0) {
    blockers.push({
      code: "REQUIRED_EVIDENCE_NOT_GENERATED",
      title: "Required evidence checklist not fully generated",
      description: `Missing required evidence kinds: ${missingRequiredEvidenceKinds.join(", ")}`,
      severity: "WARNING",
    });
  }

  if (input.change.isRestricted && suggestedApprovers.length === 0) {
    blockers.push({
      code: "RESTRICTED_CHANGE_NO_REVIEWER_COVERAGE",
      title: "Restricted change has no reviewer coverage",
      description: "Restricted change requires at least one authorized reviewer.",
      severity: "ERROR",
    });
  }

  const uniqueRecipients = uniqBy(
    suggestedRecipients,
    (r) => `${r.recipientType}::${r.recipientId}::${r.channel}`
  );

  const plan: CoordinationPlan = {
    summary: {
      coordinationSummary: `This change touches ${input.change.domain} and ${input.change.systems.length} system(s); coordination suggestions include approvers, evidence, and notification routing.`,
      whyTheseRecommendationsExist:
        "Recommendations are generated deterministically from domain, systems, change type, rollout, backfill, and organization governance mappings.",
    },
    approvals: {
      suggestedApprovers,
      missingCoverage: uniqBy(missingCoverage, (m) => `${m.type}:${m.value}:${m.reason}`),
    },
    evidence: {
      requiredItems,
      recommendedItems,
    },
    notifications: {
      suggestedRecipients: uniqueRecipients,
    },
    blockers: uniqBy(blockers, (b) => `${b.code}:${b.description}`),
    actions: {
      canApplyApprovers: suggestedApprovers.length > 0,
      canApplyEvidence: requiredItems.length + recommendedItems.length > 0,
      canApplyNotifications: uniqueRecipients.length > 0,
    },
  };

  return coordinationPlanSchema.parse(plan);
}
