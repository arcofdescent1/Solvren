/**
 * GET /api/auth/sso/discover?email=user@example.com
 * Domain-based discovery: returns only orgs whose SSO providers have
 * the email's domain in email_domains (or domain_hint for backward compat).
 * No auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

function domainMatches(
  emailDomain: string,
  provider: { email_domains?: string[] | null; domain_hint?: string | null }
): boolean {
  const domains = provider.email_domains;
  if (Array.isArray(domains) && domains.length > 0) {
    return domains.some((d) => String(d).toLowerCase() === emailDomain);
  }
  const hint = provider.domain_hint?.trim().toLowerCase();
  if (hint) return hint === emailDomain;
  return false;
}

export async function GET(req: NextRequest) {
  if (!env.ssoEnabled) {
    return NextResponse.json({ organizations: [], requiresSso: false });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ organizations: [], requiresSso: false });
  }

  const emailDomain = email.split("@")[1] ?? "";
  if (!emailDomain) return NextResponse.json({ organizations: [], requiresSso: false });

  const admin = createAdminClient();

  const { data: providers } = await admin
    .from("sso_providers")
    .select("id, org_id, protocol, display_name, enforce_sso, email_domains, domain_hint")
    .eq("enabled", true);

  if (!providers?.length) {
    return NextResponse.json({ organizations: [], requiresSso: false });
  }

  // Filter to providers whose email_domains or domain_hint matches the user's domain
  const matchingProviders = (providers as Array<{
    id: string;
    org_id: string;
    protocol: string;
    display_name?: string;
    enforce_sso?: boolean;
    email_domains?: string[] | null;
    domain_hint?: string | null;
  }>).filter((p) => domainMatches(emailDomain, p));

  if (!matchingProviders.length) {
    return NextResponse.json({ organizations: [], requiresSso: false });
  }

  const orgIds = [...new Set(matchingProviders.map((p) => p.org_id))];
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name")
    .in("id", orgIds);

  const orgMap = new Map(
    (orgs ?? []).map((o) => [(o as { id: string }).id, (o as { name: string }).name])
  );

  const byOrg = new Map<
    string,
    {
      id: string;
      name: string;
      providers: Array<{ providerId: string; protocol: string; displayName?: string }>;
      enforceSso: boolean;
    }
  >();

  for (const p of matchingProviders) {
    const name = orgMap.get(p.org_id) ?? "Organization";
    const existing = byOrg.get(p.org_id);
    const provider = {
      providerId: p.id,
      protocol: p.protocol,
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

  const organizations = Array.from(byOrg.values());
  const requiresSso = organizations.some((o) => o.enforceSso);

  return NextResponse.json({ organizations, requiresSso });
}
