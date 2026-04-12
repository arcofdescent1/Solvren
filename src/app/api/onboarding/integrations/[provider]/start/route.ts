/**
 * Guided Phase 1 — thin router to existing integration connect flows.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { ONBOARDING_PROVIDER_KEYS, type OnboardingProviderKey } from "@/modules/onboarding/domain/guided-phase1";
import { env } from "@/lib/env";

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await ctx.params;
    const p = provider?.toLowerCase();
    if (!ONBOARDING_PROVIDER_KEYS.includes(p as OnboardingProviderKey)) {
      return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
    if (!activeOrgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

    await requireOrgPermission(parseRequestedOrgId(activeOrgId), "integrations.manage");

    if (p === "salesforce") {
      return NextResponse.json({
        provider: p,
        mode: "contact",
        message: "Salesforce currently requires assisted setup. Request help from your Solvren contact.",
      });
    }

    if (p === "hubspot") {
      if (!env.hubspotIntegrationEnabled) {
        return NextResponse.json({ provider: p, mode: "contact", message: "HubSpot integration is not enabled in this environment." });
      }
      return NextResponse.json({
        provider: p,
        mode: "authorize_post",
        startUrl: "/api/integrations/hubspot/oauth/start",
        body: { organizationId: activeOrgId },
      });
    }

    if (p === "jira") {
      return NextResponse.json({
        provider: p,
        mode: "authorize_post",
        startUrl: "/api/integrations/jira/oauth/start",
        body: { organizationId: activeOrgId, returnTo: "/onboarding" },
      });
    }

    if (p === "slack") {
      const redirectUrl = `/api/integrations/slack/install?orgId=${encodeURIComponent(activeOrgId)}`;
      return NextResponse.json({
        provider: p,
        mode: "redirect_get",
        redirectUrl,
      });
    }

    if (p === "stripe") {
      return NextResponse.json({
        provider: p,
        mode: "settings",
        settingsPath: `/org/settings/integrations?orgId=${encodeURIComponent(activeOrgId)}`,
        message: "Connect Stripe with your API keys in organization integration settings.",
      });
    }

    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
