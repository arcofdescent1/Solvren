import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signSlackState } from "@/lib/slack/state";
import { env } from "@/lib/env";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;

  let body: { organizationId?: string };
  try {
    body = (await req.json()) as { organizationId?: string };
  } catch {
    body = {};
  }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }

  const { data: mem } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!mem) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminRoles = ["owner", "admin"];
  if (!adminRoles.includes((mem as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const clientId = env.slackClientId;
  if (!clientId) {
    return NextResponse.json({ error: "slack_not_configured" }, { status: 500 });
  }

  const redirectUri =
    env.slackRedirectUri ??
    new URL("/api/integrations/slack/callback", req.url).toString();

  const state = signSlackState({ orgId, userId: userRes.user.id });

  const scopes = "chat:write,commands,incoming-webhook,users:read.email,channels:read,groups:read,im:write,mpim:write";
  const userScopes = "users:read";
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("user_scope", userScopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.json({ authorizeUrl: url.toString() });
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId)
    return NextResponse.json({ ok: false, error: "missing_orgId" }, { status: 400 });

  const { data: mem } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!mem)
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clientId = env.slackClientId;
  if (!clientId)
    return NextResponse.json({ ok: false, error: "slack_not_configured" }, { status: 500 });

  const redirectUri =
    env.slackRedirectUri ??
    new URL("/api/integrations/slack/callback", req.url).toString();

  const state = signSlackState({
    orgId,
    userId: userRes.user.id,
  });

  const scopes = "chat:write,commands,incoming-webhook,users:read.email,channels:read,groups:read,im:write,mpim:write";
  const userScopes = "users:read";
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("user_scope", userScopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
