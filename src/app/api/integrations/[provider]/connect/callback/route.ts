/**
 * Phase 1 — GET /api/integrations/:provider/connect/callback (§15.1).
 * OAuth callback: state + code (or error). Completes session and redirects to redirect_uri.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { handleCallback } from "@/modules/integrations/auth/connectionManager";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import type { IntegrationProvider } from "@/modules/integrations/contracts/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (!hasProvider(provider)) {
    return NextResponse.redirect(new URL("/org/settings/integrations?error=unknown_provider", req.url));
  }

  const url = new URL(req.url);
  const stateToken = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description") ?? undefined;

  if (!stateToken) {
    return NextResponse.redirect(new URL("/org/settings/integrations?error=missing_state", req.url));
  }

  const supabase = await createServerSupabaseClient();
  const result = await handleCallback(supabase, {
    provider: provider as IntegrationProvider,
    stateToken,
    code: code ?? undefined,
    error: error ?? undefined,
    errorDescription,
  });

  const redirectUri = result.redirectUri ?? `/org/settings/integrations/${provider}`;
  const base = new URL(redirectUri.startsWith("http") ? redirectUri : req.nextUrl.origin + redirectUri);
  if (result.success) {
    base.searchParams.set("connected", "1");
    if (result.integrationAccountId) base.searchParams.set("accountId", result.integrationAccountId);
  } else {
    base.searchParams.set("error", result.errorCode ?? "callback_failed");
    if (result.errorMessage) base.searchParams.set("message", result.errorMessage);
  }
  return NextResponse.redirect(base.toString());
}
