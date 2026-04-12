import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { syncPhase2ProgressToOrgState } from "@/modules/onboarding/phase2/phase2-milestones.service";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase2AnalyticsBase } from "@/modules/onboarding/phase2/phase2-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { requirePhase2OrgContext } from "../_phase2Context";

export const runtime = "nodejs";

const CHANNEL_TYPES = ["slack", "email", "in_app"] as const;

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function assertSlackDestination(admin: ReturnType<typeof createAdminClient>, orgId: string, destination: string) {
  const parts = destination.split(":").map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false as const, message: "Slack destination must be workspace_id:channel_id" };
  }
  const [teamId] = parts;
  const { data: install } = await admin
    .from("slack_installations")
    .select("team_id, status")
    .eq("org_id", orgId)
    .maybeSingle();
  const inst = install as { team_id?: string; status?: string } | null;
  if (!inst?.team_id || inst.team_id !== teamId || (inst.status ?? "").toUpperCase() !== "ACTIVE") {
    return { ok: false as const, message: "Slack workspace does not match an active installation for this org." };
  }
  return { ok: true as const };
}

type Pref = { channelType?: string; destination?: string; enabled?: boolean };

export async function PUT(req: NextRequest) {
  const gate = await requirePhase2OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, orgId, userId } = gate.ctx;

  let body: { channels?: Pref[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const list = Array.isArray(body.channels) ? body.channels : [];
  if (list.length === 0) {
    return NextResponse.json({ error: "channels array required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const insertRows: Array<{ org_id: string; channel_type: string; destination: string; enabled: boolean }> = [];

  for (const ch of list) {
    const channelType = typeof ch.channelType === "string" ? ch.channelType.trim().toLowerCase() : "";
    if (!(CHANNEL_TYPES as readonly string[]).includes(channelType)) {
      return NextResponse.json({ error: `Invalid channelType: ${channelType}` }, { status: 400 });
    }
    const destination = typeof ch.destination === "string" ? ch.destination.trim() : "";
    if (!destination) return NextResponse.json({ error: "destination required" }, { status: 400 });
    const enabled = ch.enabled !== false;

    if (channelType === "slack") {
      const slackOk = await assertSlackDestination(admin, orgId, destination);
      if (!slackOk.ok) return NextResponse.json({ error: slackOk.message }, { status: 400 });
    } else if (channelType === "email") {
      if (!isValidEmail(destination)) return NextResponse.json({ error: "Invalid email destination" }, { status: 400 });
    } else if (channelType === "in_app") {
      if (destination !== "in_app") {
        return NextResponse.json({ error: 'in_app channel destination must be "in_app"' }, { status: 400 });
      }
    }

    insertRows.push({ org_id: orgId, channel_type: channelType, destination, enabled });
  }

  await admin.from("org_notification_preferences").delete().eq("org_id", orgId);
  const { error } = await admin.from("org_notification_preferences").insert(insertRows);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { count: wf } = await admin
    .from("detector_configs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("enabled", true);

  if ((wf ?? 0) < 1) {
    return NextResponse.json(
      { error: "Enable at least one monitoring workflow before configuring alert destinations." },
      { status: 400 }
    );
  }

  await upsertOrgOnboardingState(supabase, {
    orgId,
    phase2CurrentStep: "approval_rules",
  });
  await syncPhase2ProgressToOrgState(orgId);

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase2_notification_channel_added",
    properties: {
      ...phase2AnalyticsBase(orgId, onboardRow?.phase2_status, onboardRow?.phase2_current_step),
      channelTypes: insertRows.map((r) => r.channel_type),
      channelCount: insertRows.length,
    },
  });

  return NextResponse.json({ ok: true });
}
