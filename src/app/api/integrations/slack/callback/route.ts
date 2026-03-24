import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { verifySlackState } from "@/lib/slack/state";
import { env } from "@/lib/env";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { linkSlackIntegrationAccount } from "@/modules/integrations/providers/slack/accountLink";

async function slackOAuthAccess(code: string, redirectUri: string) {
  const body = new URLSearchParams();
  body.set("client_id", env.slackClientId!);
  body.set("client_secret", env.slackClientSecret!);
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json();
  return json;
}

async function slackGetDefaultChannel(botToken: string) {
  const res = await fetch("https://slack.com/api/conversations.list", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      limit: 200,
      types: "public_channel,private_channel",
    }),
  });

  const json = await res.json();
  if (!json?.ok) return null;

  const channels = (json.channels ?? []) as { id: string; name: string }[];
  const preferred =
    channels.find((c) => c.name === "revenue-risk") ||
    channels.find((c) => c.name === "operations") ||
    channels.find((c) => c.name === "general") ||
    channels[0];

  if (!preferred) return null;
  return { id: preferred.id, name: preferred.name };
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const code = req.nextUrl.searchParams.get("code");
  const stateB64 = req.nextUrl.searchParams.get("state");
  if (!code || !stateB64) {
    return NextResponse.json(
      { ok: false, error: "missing_code_or_state" },
      { status: 400 }
    );
  }

  let state: { orgId: string; userId: string };
  try {
    state = verifySlackState(stateB64);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "invalid_state" },
      { status: 400 }
    );
  }

  const redirectUri =
    env.slackRedirectUri ??
    new URL("/api/integrations/slack/callback", req.url).toString();

  const oauth = await slackOAuthAccess(code, redirectUri);
  if (!oauth?.ok) {
    return NextResponse.json(
      { ok: false, error: (oauth as { error?: string })?.error ?? "oauth_failed" },
      { status: 400 }
    );
  }

  const teamId = (oauth as { team?: { id?: string; name?: string } }).team?.id;
  const teamName = (oauth as { team?: { name?: string } }).team?.name ?? null;
  const botToken = (oauth as { access_token?: string }).access_token;
  const botUserId = (oauth as { bot_user_id?: string }).bot_user_id ?? null;

  if (!teamId || !botToken) {
    return NextResponse.json(
      { ok: false, error: "missing_team_or_token" },
      { status: 400 }
    );
  }

  const channel = await slackGetDefaultChannel(botToken);

  const authedSlackUserId = (oauth as { authed_user?: { id?: string } })
    ?.authed_user?.id ?? null;
  if (authedSlackUserId) {
    await admin.from("slack_user_map").upsert(
      {
        org_id: state.orgId,
        user_id: state.userId,
        slack_team_id: teamId,
        slack_user_id: authedSlackUserId,
      },
      { onConflict: "org_id,user_id" }
    );
  }

  const { error: upErr } = await admin.from("slack_installations").upsert(
    {
      org_id: state.orgId,
      team_id: teamId,
      team_name: teamName,
      bot_user_id: botUserId,
      bot_token: botToken,
      installed_by: state.userId,
      default_channel_id: channel?.id ?? null,
      default_channel_name: channel?.name ?? null,
      status: "ACTIVE",
    },
    { onConflict: "org_id" }
  );

  if (upErr) {
    return NextResponse.json(
      { ok: false, error: upErr.message },
      { status: 500 }
    );
  }

  const config = {
    teamId,
    teamName: teamName ?? undefined,
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
      approvalChannelId: channel?.id ?? null,
      riskAlertChannelId: channel?.id ?? null,
      incidentChannelId: null,
    },
    messagePolicy: {
      sendApprovalDMFirst: true,
      fallbackToApprovalChannel: true,
      broadcastHighRiskToChannel: true,
    },
  };

  await admin.from("integration_credentials").upsert(
    sealCredentialTokenFields({
      org_id: state.orgId,
      provider: "slack",
      access_token: botToken,
      refresh_token: null,
      expires_at: null,
    }),
    { onConflict: "org_id,provider" }
  );

  const { data: connRow } = await admin
    .from("integration_connections")
    .upsert(
      {
        org_id: state.orgId,
        provider: "slack",
        status: "connected",
        config,
      },
      { onConflict: "org_id,provider" }
    )
    .select("id")
    .single();

  const connId = (connRow as { id?: string } | null)?.id ?? null;
  if (connId) {
    await admin.from("slack_workspace_links").upsert(
      {
        org_id: state.orgId,
        integration_connection_id: connId,
        slack_team_id: teamId,
        slack_team_name: teamName ?? null,
        bot_user_id: botUserId ?? null,
        installed_by_user_id: state.userId,
      },
      { onConflict: "org_id" }
    );
  }

  await linkSlackIntegrationAccount(admin, {
    orgId: state.orgId,
    userId: state.userId,
    teamId,
    teamName,
  });

  await auditLog(supabase, {
    orgId: state.orgId,
    actorId: state.userId,
    actorType: "USER",
    action: "slack_connected",
    entityType: "integration",
    entityId: "slack",
    metadata: { teamId, teamName, defaultChannel: channel },
  });

  return NextResponse.redirect(
    new URL(`/org/settings/integrations/slack?orgId=${state.orgId}&slack=connected`, new URL(req.url).origin)
  );
}
