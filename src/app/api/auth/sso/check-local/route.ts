/**
 * POST /api/auth/sso/check-local
 * Body: { email: string, organizationId?: string }
 * Returns whether local (password) login is allowed for this email.
 * If any org with SSO for this user has enforce_sso and email is not in break-glass list, local login is disallowed.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  let body: { email?: string; organizationId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const breakGlass = env.ssoBreakGlassEmails;
  if (breakGlass.includes(email)) {
    return NextResponse.json({ allowed: true, ssoRequired: false });
  }

  if (!env.ssoEnabled) {
    return NextResponse.json({ allowed: true, ssoRequired: false });
  }

  const admin = createAdminClient();

  let query = admin
    .from("sso_providers")
    .select("id, org_id, enforce_sso")
    .eq("enabled", true);

  if (body.organizationId) {
    query = query.eq("org_id", body.organizationId);
  }

  const { data: rows } = await query;

  if (!rows?.length) {
    return NextResponse.json({ allowed: true, ssoRequired: false });
  }

  const enforcing = (rows as Array<{ org_id: string; enforce_sso?: boolean }>).filter(
    (r) => r.enforce_sso === true
  );
  if (enforcing.length === 0) {
    return NextResponse.json({ allowed: true, ssoRequired: false });
  }

  const orgIds = [...new Set(enforcing.map((r) => r.org_id))];
  const { data: orgs } = await admin.from("organizations").select("id, name").in("id", orgIds);
  const orgList = (orgs ?? []).map((o) => ({
    id: (o as { id: string }).id,
    name: (o as { name: string }).name,
  }));

  return NextResponse.json({
    allowed: false,
    ssoRequired: true,
    organizations: orgList,
  });
}
