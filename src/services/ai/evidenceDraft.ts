import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVIDENCE_KIND_LABEL,
  type EvidenceKind,
} from "@/services/risk/requirements";

type ChangeCtx = {
  id: string;
  title: string | null;
  change_type: string | null;
  status: string | null;
  domain: string | null;
  intake: unknown;
  systems_involved: string[] | null;
  revenue_impact_areas: string[] | null;
  requested_release_at: string | null;
  due_at: string | null;
  sla_status: string | null;
  risk_explanation: unknown;
};

function mdList(items: string[]) {
  return items.map((x) => `- ${x}`).join("\n");
}

function getDescription(intake: unknown): string {
  if (intake && typeof intake === "object") {
    const d = (intake as Record<string, unknown>).description;
    if (typeof d === "string") return d.trim();
  }
  return "";
}

export type EvidenceDraft = {
  kind: EvidenceKind;
  suggestedLabel: string;
  draftNoteMd: string;
};

export async function generateEvidenceDraft(
  supabase: SupabaseClient,
  args: { changeId: string; kind: EvidenceKind }
): Promise<EvidenceDraft> {
  const { changeId, kind } = args;

  const { data: change, error } = await scopeActiveChangeEvents(supabase.from("change_events").select(
      "id,title,change_type,status,domain,intake,systems_involved,revenue_impact_areas,requested_release_at,due_at,sla_status,risk_explanation"
    ))
    .eq("id", changeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!change) throw new Error("Change not found");

  const c = change as unknown as ChangeCtx;

  const title = c.title ?? "(untitled change)";
  const desc = getDescription(c.intake);
  const systems = (c.systems_involved ?? []) as string[];
  const impacts = (c.revenue_impact_areas ?? []) as string[];
  const requestedAt = c.requested_release_at
    ? new Date(c.requested_release_at).toISOString()
    : null;

  const header = `# ${EVIDENCE_KIND_LABEL[kind]}\n\n**Change:** ${title}\n\n`;

  if (kind === "ROLLBACK") {
    const checklist = [
      "Trigger: what conditions cause rollback (metrics, errors, customer impact).",
      "Exact rollback steps (commands, toggles, deployment, config).",
      "Data considerations: how to handle partial writes / migrations / reconciliation.",
      "Owner + comms: who calls rollback, who notifies whom.",
      "Time estimate and verification steps post-rollback.",
    ];
    const draft = [
      header,
      desc ? `## Context\n${desc}\n\n` : "",
      systems.length ? `## Systems impacted\n${mdList(systems)}\n\n` : "",
      impacts.length ? `## Impact areas\n${mdList(impacts)}\n\n` : "",
      "## Rollback trigger\n- (define concrete thresholds here)\n\n",
      "## Rollback steps\n1. (step 1)\n2. (step 2)\n3. (step 3)\n\n",
      "## Data & recovery considerations\n- (migrations/backfills/reconciliation)\n\n",
      "## Verification after rollback\n- (what to check to confirm safe state)\n\n",
      "## Owner & comms\n- Owner: (name)\n- Notifies: (who/when/how)\n\n",
      "## Checklist\n",
      mdList(checklist),
      "\n",
    ].join("");
    return {
      kind,
      suggestedLabel: `${title} — Rollback Plan`,
      draftNoteMd: draft,
    };
  }

  if (kind === "DASHBOARD") {
    const checklist = [
      "Primary success metrics (before/after baseline + thresholds).",
      "Error and latency metrics + alerting thresholds.",
      "Billing/payment pipeline health (if applicable): failed charges, refunds, invoice anomalies.",
      "Support impact proxy metrics (ticket volume, key keywords).",
      "Link(s) to dashboards and how to interpret them.",
    ];
    const draft = [
      header,
      desc ? `## Context\n${desc}\n\n` : "",
      requestedAt ? `**Requested release:** ${requestedAt}\n\n` : "",
      "## What to monitor\n- (metric) — threshold — alert rule\n- (metric) — threshold — alert rule\n\n",
      "## Dashboards\n- (link) — purpose\n- (link) — purpose\n\n",
      "## Roll-forward validation\n- (what you expect to see if the release is healthy)\n\n",
      "## Checklist\n",
      mdList(checklist),
      "\n",
    ].join("");
    return {
      kind,
      suggestedLabel: `${title} — Validation Dashboard & Monitoring Plan`,
      draftNoteMd: draft,
    };
  }

  if (kind === "COMMS_PLAN") {
    const checklist = [
      "Audience: who is impacted and who needs to know (customers/internal).",
      "Timing: when we communicate (pre-release, during, post).",
      "Message: what is changing, why, and what users should do (if anything).",
      "Support prep: FAQ + escalation path + owner on call.",
      "Rollback messaging: what we say if we revert.",
    ];
    const draft = [
      header,
      desc ? `## Context\n${desc}\n\n` : "",
      "## Audience\n- Customers: (segment / cohort)\n- Internal: Support, Sales, Finance, etc.\n\n",
      "## Timeline\n- T-24h: (message)\n- T-0: (message)\n- T+2h: (follow-up)\n\n",
      "## Message draft\n> (write the customer-facing copy here)\n\n",
      "## Support readiness\n- FAQ link: (link)\n- Escalation owner: (name)\n\n",
      "## Rollback messaging\n> (what do we say if we revert?)\n\n",
      "## Checklist\n",
      mdList(checklist),
      "\n",
    ].join("");
    return {
      kind,
      suggestedLabel: `${title} — Customer Comms Plan`,
      draftNoteMd: draft,
    };
  }

  const draft = [
    header,
    desc ? `## Context\n${desc}\n\n` : "",
    "## Notes\n- (add details here)\n",
  ].join("");

  return {
    kind,
    suggestedLabel: `${title} — ${EVIDENCE_KIND_LABEL[kind]}`,
    draftNoteMd: draft,
  };
}
