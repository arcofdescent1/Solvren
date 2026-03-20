/**
 * Phase 8 — Executive Hero scenario.
 * Hero dashboard with recovered revenue, avoided loss, active issues, timeline.
 */
import { buildSeedIssues } from "../builders/seed-issues.builder";
import { buildSeedActions } from "../builders/seed-actions.builder";
import { buildSeedOutcomes } from "../builders/seed-roi.builder";
import { buildSeedTimelineEvents } from "../builders/seed-timeline.builder";
import { seededUuid } from "../builders/seed-helpers";

const SCENARIO_KEY = "executive_hero";
const SEED_VERSION = "1.0.0";

export function buildExecutiveHeroSeed(orgId: string) {
  // Issues mix: 15 active, 20 resolved, 15 verified (50 total)
  const issueInputs: Parameters<typeof buildSeedIssues>[0] = [];

  for (let i = 0; i < 15; i++) {
    issueInputs.push({
      orgId,
      scenarioKey: SCENARIO_KEY,
      seedVersion: SEED_VERSION,
      baseIndex: i,
      domainKey: i % 3 === 0 ? "BILLING" : i % 3 === 1 ? "CRM" : "CHANGE",
      title: `Demo active issue ${i + 1}: Revenue at risk`,
      description: "Demo scenario issue for executive hero view.",
      severity: i < 5 ? "critical" : i < 10 ? "high" : "medium",
      status: "open",
      sourceType: "detector",
      sourceRef: `demo-${SCENARIO_KEY}-${i}`,
      daysAgo: i % 5,
    });
  }
  for (let i = 15; i < 35; i++) {
    issueInputs.push({
      orgId,
      scenarioKey: SCENARIO_KEY,
      seedVersion: SEED_VERSION,
      baseIndex: i,
      domainKey: "BILLING",
      title: `Demo resolved issue ${i + 1}`,
      description: "Demo scenario issue.",
      severity: "high",
      status: "resolved",
      sourceType: "detector",
      sourceRef: `demo-${SCENARIO_KEY}-${i}`,
      daysAgo: 7 + (i % 14),
    });
  }
  for (let i = 35; i < 50; i++) {
    issueInputs.push({
      orgId,
      scenarioKey: SCENARIO_KEY,
      seedVersion: SEED_VERSION,
      baseIndex: i,
      domainKey: "CRM",
      title: `Demo verified issue ${i + 1}`,
      description: "Demo scenario issue.",
      severity: "medium",
      status: "verified",
      sourceType: "integration_event",
      sourceRef: `demo-${SCENARIO_KEY}-${i}`,
      daysAgo: 14 + (i % 7),
    });
  }

  const issues = buildSeedIssues(issueInputs);
  const issueIdByKey = new Map(issues.map((iss) => [(iss as { issue_key: string }).issue_key, (iss as { id: string }).id]));

  // Actions for resolved/verified issues
  const actionInputs: Parameters<typeof buildSeedActions>[0] = [];
  issues.slice(15, 45).forEach((iss, idx) => {
    const ik = (iss as { issue_key: string }).issue_key;
    const iid = (iss as { id: string }).id;
    actionInputs.push({
      orgId,
      issueId: iid,
      issueKey: ik,
      actionType: idx % 2 === 0 ? "stripe.retry_payment" : "crm.assign_owner",
      actionStatus: "completed",
      daysAgo: 5 + (idx % 5),
    });
  });
  const actions = buildSeedActions(actionInputs);
  const actionByIssue = new Map<string, string>();
  actions.forEach((a) => {
    const issueId = (a as { issue_id: string }).issue_id;
    if (!actionByIssue.has(issueId)) {
      actionByIssue.set(issueId, (a as { id: string }).id);
    }
  });

  // Outcomes: 10 recovered, 10 avoided, 5 operational
  const outcomeInputs: Parameters<typeof buildSeedOutcomes>[0] = [];
  let oIdx = 0;
  issues.slice(15, 25).forEach((iss) => {
    const iid = (iss as { id: string }).id;
    outcomeInputs.push({
      orgId,
      issueId: iid,
      actionId: actionByIssue.get(iid) ?? null,
      outcomeType: "recovered_revenue",
      amount: 500 + (parseInt(seededUuid(`amt-${iid}`).slice(0, 4), 16) % 5000),
      daysAgo: 3 + (oIdx++ % 5),
    });
  });
  issues.slice(25, 35).forEach((iss) => {
    const iid = (iss as { id: string }).id;
    outcomeInputs.push({
      orgId,
      issueId: iid,
      actionId: actionByIssue.get(iid) ?? null,
      outcomeType: "avoided_loss",
      amount: 1000 + (parseInt(seededUuid(`amt2-${iid}`).slice(0, 4), 16) % 8000),
      daysAgo: 2 + (oIdx++ % 4),
    });
  });
  issues.slice(35, 40).forEach((iss) => {
    const iid = (iss as { id: string }).id;
    outcomeInputs.push({
      orgId,
      issueId: iid,
      outcomeType: "operational_savings",
      amount: 200 + (parseInt(seededUuid(`amt3-${iid}`).slice(0, 4), 16) % 1500),
      daysAgo: 1 + (oIdx++ % 3),
    });
  });

  const outcomes = buildSeedOutcomes(outcomeInputs);

  // Timeline events
  const timelineInputs: Parameters<typeof buildSeedTimelineEvents>[0] = [];
  outcomes.slice(0, 15).forEach((o, idx) => {
    const iss = issues[15 + idx];
    const iid = iss ? (iss as { id: string }).id : null;
    const amt = (o as { amount: number }).amount;
    const typ = (o as { outcome_type: string }).outcome_type;
    timelineInputs.push({
      orgId,
      issueId: iid ?? undefined,
      category: "outcome",
      eventType: typ === "recovered_revenue" ? "revenue_recovered" : typ === "avoided_loss" ? "loss_avoided" : "operational_savings",
      headline: `$${amt.toLocaleString()} ${typ.replace("_", " ")}`,
      summary: `Demo outcome recorded for executive hero.`,
      amount: amt,
      valueType: typ,
      daysAgo: idx % 7,
    });
  });
  const timeline = buildSeedTimelineEvents(timelineInputs);

  return {
    scenarioKey: SCENARIO_KEY,
    seedVersion: SEED_VERSION,
    issues,
    actions,
    outcomes,
    timeline,
    manifest: {
      tablesSeeded: ["issues", "issue_actions", "outcomes", "revenue_timeline_events"],
      countsExpected: {
        issues: 50,
        issue_actions: 30,
        outcomes: 25,
        revenue_timeline_events: 15,
      },
      scenarioNarrativeObjects: ["executive_hero", "recovered_revenue", "avoided_loss", "operational_savings"],
    },
  };
}
