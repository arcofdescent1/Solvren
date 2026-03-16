import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signHubSpotState } from "@/lib/hubspot/state";
import { env } from "@/lib/env";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";

const SCOPES = "crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read crm.schemas.contacts.read crm.schemas.companies.read crm.schemas.deals.read";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
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

  const clientId = env.hubspotClientId;
  if (!clientId) return NextResponse.json({ error: "hubspot_not_configured" }, { status: 500 });

  const redirectUri = env.hubspotRedirectUri ?? `${env.appUrl}/api/integrations/hubspot/oauth/callback`;
  const state = signHubSpotState({ orgId, userId: userRes.user.id });

  const url = new URL(env.hubspotOAuthAuthorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);

  return NextResponse.json({ authorizeUrl: url.toString() });
}
