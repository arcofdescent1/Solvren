/**
 * GET /api/integrations/:provider/health
 * Standardized health endpoint for all providers.
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationHealthService, getCapabilities, INTEGRATION_PROVIDERS } from "@/modules/integrations";
import type { IntegrationProvider } from "@/modules/integrations/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = (await params).provider as IntegrationProvider;
  if (!INTEGRATION_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const healthSvc = new IntegrationHealthService(admin);
    const health = await healthSvc.getHealth(orgId, provider);
    const capabilities = getCapabilities(provider);

    const { data: connRow } = await admin
      .from("integration_connections")
      .select("status")
      .eq("org_id", orgId)
      .eq("provider", provider)
      .maybeSingle();

    const connectionStatus = (connRow as { status?: string } | null)?.status ?? "disconnected";

    return NextResponse.json({
    provider,
    connectionStatus,
    healthStatus: health?.healthStatus ?? null,
    lastSuccessAt: health?.lastSuccessAt ?? null,
    lastError: health?.lastError ?? null,
    capabilities: {
      supportsWebhooks: capabilities.supportsWebhooks ?? false,
      supportsRetry: capabilities.supportsRetry ?? false,
      supportsStatusSync: capabilities.supportsStatusSync ?? false,
    },
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Health check failed";
    return NextResponse.json(
      { error: msg, provider, connectionStatus: "unknown", healthStatus: null },
      { status: 503 }
    );
  }
}
