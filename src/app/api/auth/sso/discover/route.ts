/**
 * GET /api/auth/sso/discover?email=user@example.com
 * Returns organizations with SSO for email-first login flow. No auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  if (!env.ssoEnabled) {
    return NextResponse.json({ organizations: [], requiresSso: false });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ organizations: [], requiresSso: false });
  }

  const admin = createAdminClient();

  const { data: providers } = await admin
    .from("sso_providers")
    .select("id, org_id, protocol, display_name, enforce_sso")
    .eq("enabled", true);

  if (!providers?.length) {
    return NextResponse.json({ organizations: [], requiresSso: false });
  }

  const orgIds = [...new Set((providers as Array<{ org_id: string }>).map((p) => p.org_id))];
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name")
    .in("id", orgIds);

  const orgMap = new Map(
    (orgs ?? []).map((o) => [(o as { id: string }).id, (o as { name: string }).name])
  );

  const byOrg = new Map<
    string,
    { id: string; name: string; providers: Array<{ providerId: string; providerType: string; displayName?: string }>; enforceSso: boolean }
  >();

  for (const p of providers as Array<{ id: string; org_id: string; protocol: string; display_name?: string; enforce_sso?: boolean }>) {
    const name = orgMap.get(p.org_id) ?? "Organization";
    const existing = byOrg.get(p.org_id);
    const provider = {
      providerId: p.id,
      providerType: p.protocol,
      displayName: p.display_name ?? undefined,
    };
    if (existing) {
      existing.providers.push(provider);
      if (p.enforce_sso) existing.enforceSso = true;
    } else {
      byOrg.set(p.org_id, {
        id: p.org_id,
        name,
        providers: [provider],
        enforceSso: p.enforce_sso === true,
      });
    }
  }

  const organizations = Array.from(byOrg.values()).map((o) => ({
    id: o.id,
    name: o.name,
    providers: o.providers,
    enforceSso: o.enforceSso,
  }));

  const requiresSso = organizations.some((o) => o.enforceSso);

  return NextResponse.json({ organizations, requiresSso });
}
