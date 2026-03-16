/**
 * GET /api/org/settings/sso/providers/[providerId] - Fetch SSO provider config
 * PUT /api/org/settings/sso/providers/[providerId] - Update SSO provider config
 * Query: orgId (required)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";

type SsoProviderRow = {
  id?: string;
  org_id?: string;
  provider_type?: string;
  protocol?: string;
  display_name?: string;
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  end_session_endpoint?: string;
  saml_sso_url?: string;
  saml_entity_id?: string;
  saml_certificate?: string;
  client_id?: string;
  client_secret?: string;
  domain_hint?: string;
  enabled?: boolean;
  enforce_sso?: boolean;
  allow_local_fallback?: boolean;
  allow_jit_provisioning?: boolean;
  attribute_mappings?: unknown;
  scopes?: string;
  created_at?: string;
  updated_at?: string;
};

function toCamelCase(row: SsoProviderRow | null): Record<string, unknown> | null {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    providerType: row.provider_type,
    protocol: row.protocol,
    displayName: row.display_name,
    issuer: row.issuer,
    authorizationEndpoint: row.authorization_endpoint,
    tokenEndpoint: row.token_endpoint,
    userinfoEndpoint: row.userinfo_endpoint,
    jwksUri: row.jwks_uri,
    endSessionEndpoint: row.end_session_endpoint,
    samlSsoUrl: row.saml_sso_url,
    samlEntityId: row.saml_entity_id,
    samlCertificate: row.saml_certificate,
    clientId: row.client_id,
    domainHint: row.domain_hint,
    enabled: row.enabled,
    enforceSso: row.enforce_sso,
    allowLocalFallback: row.allow_local_fallback,
    allowJitProvisioning: row.allow_jit_provisioning,
    attributeMappings: row.attribute_mappings,
    scopes: row.scopes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireAdminOrg(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  orgId: string
) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { status: 401 as const };
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return { status: 403 as const };
  }
  return { status: null };
}

/**
 * GET - Return provider config (snake_case DB columns mapped to camelCase).
 * client_secret is omitted from response for security.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params;
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  if (!providerId) return NextResponse.json({ error: "providerId required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const auth = await requireAdminOrg(supabase, orgId);
  if (auth.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: provider, error } = await admin
    .from("sso_providers")
    .select("*")
    .eq("id", providerId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const body = toCamelCase(provider as SsoProviderRow);
  return NextResponse.json(body);
}

type PutBody = Partial<{
  displayName: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  jwksUri: string;
  endSessionEndpoint: string;
  samlSsoUrl: string;
  samlEntityId: string;
  samlCertificate: string;
  clientId: string;
  clientSecret: string;
  domainHint: string;
  enabled: boolean;
  enforceSso: boolean;
  allowLocalFallback: boolean;
  allowJitProvisioning: boolean;
  attributeMappings: unknown;
  scopes: string;
}>;

/**
 * PUT - Update provider config. Accepts camelCase; updates snake_case DB columns.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params;
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  if (!providerId) return NextResponse.json({ error: "providerId required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const auth = await requireAdminOrg(supabase, orgId);
  if (auth.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.displayName !== undefined) updates.display_name = body.displayName;
  if (body.issuer !== undefined) updates.issuer = body.issuer;
  if (body.authorizationEndpoint !== undefined) updates.authorization_endpoint = body.authorizationEndpoint;
  if (body.tokenEndpoint !== undefined) updates.token_endpoint = body.tokenEndpoint;
  if (body.userinfoEndpoint !== undefined) updates.userinfo_endpoint = body.userinfoEndpoint;
  if (body.jwksUri !== undefined) updates.jwks_uri = body.jwksUri;
  if (body.endSessionEndpoint !== undefined) updates.end_session_endpoint = body.endSessionEndpoint;
  if (body.samlSsoUrl !== undefined) updates.saml_sso_url = body.samlSsoUrl;
  if (body.samlEntityId !== undefined) updates.saml_entity_id = body.samlEntityId;
  if (body.samlCertificate !== undefined) updates.saml_certificate = body.samlCertificate;
  if (body.clientId !== undefined) updates.client_id = body.clientId;
  if (body.clientSecret !== undefined) updates.client_secret = body.clientSecret;
  if (body.domainHint !== undefined) updates.domain_hint = body.domainHint;
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (typeof body.enforceSso === "boolean") updates.enforce_sso = body.enforceSso;
  if (typeof body.allowLocalFallback === "boolean") updates.allow_local_fallback = body.allowLocalFallback;
  if (typeof body.allowJitProvisioning === "boolean") updates.allow_jit_provisioning = body.allowJitProvisioning;
  if (body.attributeMappings !== undefined) updates.attribute_mappings = body.attributeMappings;
  if (body.scopes !== undefined) updates.scopes = body.scopes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: provider, error } = await admin
    .from("sso_providers")
    .update(updates)
    .eq("id", providerId)
    .eq("org_id", orgId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const { data: userRes } = await supabase.auth.getUser();
  try {
    await auditLog(admin as Parameters<typeof auditLog>[0], {
      orgId,
      actorId: userRes.user?.id ?? null,
      actorType: "USER",
      action: "sso.provider.updated",
      entityType: "sso_provider",
      entityId: providerId,
      metadata: { displayName: (provider as SsoProviderRow).display_name },
    });
  } catch {
    // non-fatal
  }

  const response = toCamelCase(provider as SsoProviderRow);
  return NextResponse.json(response);
}