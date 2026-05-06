/**
 * Phase 5 — Consistent LLM privacy enforcement for API routes.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertLlmOperationalPromptAllowed, OrgPrivacyNotFoundError } from "@/lib/server/privacy/operational-persist";
import { PrivacyPolicyError } from "@/lib/server/privacy/privacy-policy";

export async function guardOrgLlmPrompt(
  supabase: SupabaseClient,
  orgId: string | null | undefined
): Promise<NextResponse | null> {
  if (!orgId?.trim()) {
    return NextResponse.json({ error: "Organization required for AI processing" }, { status: 400 });
  }
  try {
    await assertLlmOperationalPromptAllowed(supabase, orgId);
    return null;
  } catch (e) {
    if (e instanceof PrivacyPolicyError || e instanceof OrgPrivacyNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
