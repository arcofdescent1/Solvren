import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrgOnboardingState,
  upsertOrgOnboardingState,
} from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { syncPhase2ProgressToOrgState } from "@/modules/onboarding/phase2/phase2-milestones.service";
import { isRiskPriorityCategoryKey } from "@/modules/onboarding/phase2/risk-priority-catalog";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase2AnalyticsBase } from "@/modules/onboarding/phase2/phase2-analytics-payload";
import { requirePhase2OrgContext } from "../_phase2Context";

export const runtime = "nodejs";

type PriorityInput = {
  category?: string;
  priorityRank?: number;
  departments?: unknown;
  severityThreshold?: string;
  notificationUrgency?: string;
};

export async function PUT(req: NextRequest) {
  const gate = await requirePhase2OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, orgId, userId } = gate.ctx;

  let body: { priorities?: PriorityInput[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(body.priorities) ? body.priorities : [];
  if (raw.length < 1 || raw.length > 3) {
    return NextResponse.json({ error: "Select between 1 and 3 risk priorities." }, { status: 400 });
  }

  const rows: Array<{
    org_id: string;
    category: string;
    priority_rank: number;
    departments: string[];
    severity_threshold: string | null;
    notification_urgency: string | null;
  }> = [];

  const ranks = new Set<number>();
  for (const p of raw) {
    const cat = typeof p.category === "string" ? p.category.trim() : "";
    if (!isRiskPriorityCategoryKey(cat)) {
      return NextResponse.json({ error: `Invalid category: ${cat}` }, { status: 400 });
    }
    const pr = typeof p.priorityRank === "number" ? p.priorityRank : Number(p.priorityRank);
    if (!Number.isFinite(pr) || pr < 1 || pr > 3) {
      return NextResponse.json({ error: "priorityRank must be 1–3" }, { status: 400 });
    }
    if (ranks.has(pr)) return NextResponse.json({ error: "Duplicate priorityRank" }, { status: 400 });
    ranks.add(pr);

    const depts = Array.isArray(p.departments) ? p.departments.filter((d) => typeof d === "string" && d.trim()) : [];
    if (depts.length < 1) {
      return NextResponse.json({ error: "Each priority needs at least one department." }, { status: 400 });
    }

    rows.push({
      org_id: orgId,
      category: cat,
      priority_rank: pr,
      departments: depts as string[],
      severity_threshold: typeof p.severityThreshold === "string" ? p.severityThreshold : null,
      notification_urgency: typeof p.notificationUrgency === "string" ? p.notificationUrgency : null,
    });
  }

  const admin = createAdminClient();
  await admin.from("org_risk_priorities").delete().eq("org_id", orgId);
  const { error } = await admin.from("org_risk_priorities").insert(
    rows.map((r) => ({
      ...r,
      departments: r.departments,
    }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await upsertOrgOnboardingState(supabase, {
    orgId,
    phase2CurrentStep: "workflow_alerts",
  });
  await syncPhase2ProgressToOrgState(orgId);

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase2_risk_priorities_saved",
    properties: {
      ...phase2AnalyticsBase(orgId, onboardRow?.phase2_status, onboardRow?.phase2_current_step),
      categoryCount: rows.length,
      categories: rows.map((r) => r.category),
    },
  });

  return NextResponse.json({ ok: true });
}
