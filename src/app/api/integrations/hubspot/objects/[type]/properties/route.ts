/**
 * GET /api/integrations/hubspot/objects/[type]/properties
 * Get properties for a HubSpot object type (deals, contacts, etc).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { refreshAccessToken, needsRefresh } from "@/services/hubspot/HubSpotAuthService";
import { env } from "@/lib/env";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const orgId = req.nextUrl.searchParams.get("orgId");
  const objectType = (await params).type;
  if (!orgId || !objectType) return NextResponse.json({ error: "orgId and type required" }, { status: 400 });

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: account } = await admin
    .from("hubspot_accounts")
    .select("auth_mode")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: creds } = await admin
    .from("integration_credentials")
    .select("access_token, refresh_token, expires_at, private_app_token")
    .eq("org_id", orgId)
    .eq("provider", "hubspot")
    .maybeSingle();

  if (!account || !creds) return NextResponse.json({ error: "HubSpot not connected" }, { status: 400 });

  const authMode = (account as { auth_mode: string }).auth_mode;
  let accessToken: string;

  if (authMode === "private_app") {
    accessToken = (creds as { private_app_token?: string }).private_app_token ?? (creds as { access_token?: string }).access_token ?? "";
  } else {
    const token = (creds as { access_token?: string }).access_token;
    const refresh = (creds as { refresh_token?: string }).refresh_token;
    const expiresAt = (creds as { expires_at?: string })?.expires_at ?? null;
    if (!token || !refresh) return NextResponse.json({ error: "Missing OAuth credentials" }, { status: 400 });
    if (needsRefresh(expiresAt)) {
      const refreshed = await refreshAccessToken(refresh);
      accessToken = refreshed.accessToken;
      await admin
        .from("integration_credentials")
        .update({ access_token: refreshed.accessToken })
        .eq("org_id", orgId)
        .eq("provider", "hubspot");
    } else {
      accessToken = token;
    }
  }

  const client = new HubSpotClient({ accessToken });

  try {
    const { properties } = await client.getObjectProperties(objectType);
    return NextResponse.json({ properties });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to get properties" },
      { status: 500 }
    );
  }
}
