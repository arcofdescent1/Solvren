/**
 * Phase 2 — first live result for polling (real persisted rows only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type LiveResultEvent = {
  type: string;
  title: string;
  description: string;
  createdAt: string;
  ctaUrl: string;
};

type Candidate = { at: string; event: LiveResultEvent };

function earliest(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return candidates[0] ?? null;
}

export async function getPhase2LiveResult(admin: SupabaseClient, orgId: string): Promise<LiveResultEvent | null> {
  const candidates: Candidate[] = [];

  const { data: issue } = await admin
    .from("issues")
    .select("id, title, created_at, description")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (issue) {
    const i = issue as { id: string; title?: string; created_at: string; description?: string | null };
    candidates.push({
      at: i.created_at,
      event: {
        type: "issue_detected",
        title: i.title ?? "Issue detected",
        description: i.description ?? "Solvren recorded a revenue-impacting issue for your organization.",
        createdAt: i.created_at,
        ctaUrl: `/issues/${i.id}`,
      },
    });
  }

  const { data: appr } = await admin
    .from("approvals")
    .select("id, change_event_id")
    .eq("org_id", orgId)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (appr) {
    const a = appr as { id: string; change_event_id: string };
    const { data: ce } = await admin.from("change_events").select("created_at").eq("id", a.change_event_id).maybeSingle();
    const at = (ce as { created_at?: string } | null)?.created_at ?? new Date().toISOString();
    candidates.push({
      at,
      event: {
        type: "approval_request_created",
        title: "Approval request created",
        description: "A governed change now has an active approval request in Solvren.",
        createdAt: at,
        ctaUrl: `/changes`,
      },
    });
  }

  const { data: wr } = await admin
    .from("workflow_runs")
    .select("id, started_at")
    .eq("org_id", orgId)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (wr) {
    const w = wr as { id: string; started_at: string };
    candidates.push({
      at: w.started_at,
      event: {
        type: "workflow_rule_triggered",
        title: "Workflow run recorded",
        description: "A monitoring workflow executed against your organization data.",
        createdAt: w.started_at,
        ctaUrl: `/readiness`,
      },
    });
  }

  const { data: nx } = await admin
    .from("notification_outbox")
    .select("id, created_at, channel, template_key, delivered_at, sent_at")
    .eq("org_id", orgId)
    .or("delivered_at.not.is.null,sent_at.not.is.null")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nx) {
    const n = nx as {
      id: string;
      created_at: string;
      channel?: string;
      template_key?: string;
      delivered_at?: string | null;
      sent_at?: string | null;
    };
    const at = n.delivered_at ?? n.sent_at ?? n.created_at;
    candidates.push({
      at,
      event: {
        type: "alert_delivered",
        title: "Alert delivered",
        description: n.template_key
          ? `A ${n.channel ?? "channel"} notification was delivered (${n.template_key}).`
          : `A ${n.channel ?? "channel"} notification was delivered to your organization.`,
        createdAt: at,
        ctaUrl: `/actions`,
      },
    });
  }

  const picked = earliest(candidates);
  return picked?.event ?? null;
}
