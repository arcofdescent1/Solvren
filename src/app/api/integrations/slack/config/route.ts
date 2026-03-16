import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";

type SlackConfig = {
  teamId?: string;
  teamName?: string;
  enabled?: boolean;
  features?: {
    approvalMessages?: boolean;
    riskAlerts?: boolean;
    approvalDMs?: boolean;
    channelAlerts?: boolean;
    slashCommands?: boolean;
    interactiveActions?: boolean;
  };
  routing?: {
    approvalChannelId?: string | null;
    riskAlertChannelId?: string | null;
    incidentChannelId?: string | null;
  };
  messagePolicy?: {
    sendApprovalDMFirst?: boolean;
    fallbackToApprovalChannel?: boolean;
    broadcastHighRiskToChannel?: boolean;
  };
};

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: install } = await admin
    .from("slack_installations")
    .select("team_id, team_name, default_channel_id, default_channel_name, status")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: conn } = await admin
    .from("integration_connections")
    .select("status, config, last_error, last_success_at, health_status")
    .eq("org_id", orgId)
    .eq("provider", "slack")
    .maybeSingle();

  const c = conn as {
    status?: string;
    config?: SlackConfig;
    last_error?: string;
    last_success_at?: string;
    health_status?: string;
  } | null;

  const connected = Boolean(install?.team_id && (install as { status?: string }).status === "ACTIVE");
  const config = c?.config ?? {
    teamId: (install as { team_id?: string })?.team_id,
    teamName: (install as { team_name?: string })?.team_name ?? undefined,
    enabled: true,
    features: {
      approvalMessages: true,
      riskAlerts: true,
      approvalDMs: true,
      channelAlerts: true,
      slashCommands: true,
      interactiveActions: true,
    },
    routing: {
      approvalChannelId: (install as { default_channel_id?: string })?.default_channel_id ?? null,
      riskAlertChannelId: (install as { default_channel_id?: string })?.default_channel_id ?? null,
      incidentChannelId: null,
    },
    messagePolicy: {
      sendApprovalDMFirst: true,
      fallbackToApprovalChannel: true,
      broadcastHighRiskToChannel: true,
    },
  };

  return NextResponse.json({
    connected,
    teamId: config.teamId ?? install?.team_id,
    teamName: config.teamName ?? install?.team_name ?? null,
    config,
    health: {
      status: c?.health_status ?? null,
      lastSuccessAt: c?.last_success_at ?? null,
      lastError: c?.last_error ?? null,
      failedDeliveryCount: 0,
    },
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { data: conn } = await admin
    .from("integration_connections")
    .select("id, status, config")
    .eq("org_id", orgId)
    .eq("provider", "slack")
    .maybeSingle();

  const existing = conn as { status?: string; config?: SlackConfig } | null;
  const { data: installExists } = await admin
    .from("slack_installations")
    .select("org_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!installExists?.org_id) {
    return NextResponse.json(
      { error: "Slack not connected for this organization" },
      { status: 400 }
    );
  }

  let body: Partial<SlackConfig>;
  try {
    body = (await req.json()) as Partial<SlackConfig>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const merged: SlackConfig = {
    ...(existing?.config ?? {}),
    ...body,
  };

  await admin
    .from("integration_connections")
    .upsert(
      {
        org_id: orgId,
        provider: "slack",
        status: existing?.status ?? "connected",
        config: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider" }
    );

  const { data: install } = await admin
    .from("slack_installations")
    .select("default_channel_id, default_channel_name")
    .eq("org_id", orgId)
    .maybeSingle();

  const routing = merged.routing ?? {};
  const defaultChannelId = routing.approvalChannelId ?? routing.riskAlertChannelId ?? (install as { default_channel_id?: string })?.default_channel_id;
  const defaultChannelName = (install as { default_channel_name?: string })?.default_channel_name ?? null;

  await admin
    .from("slack_installations")
    .update({
      default_channel_id: defaultChannelId ?? null,
      default_channel_name: defaultChannelName,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  await auditLog(supabase, {
    orgId,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "slack.config.updated",
    entityType: "integration",
    entityId: "slack",
    metadata: { routing: merged.routing, features: merged.features },
  });

  return NextResponse.json({ status: "ok" });
}
