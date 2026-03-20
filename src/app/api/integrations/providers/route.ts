/**
 * Phase 1 — GET /api/integrations/providers (§15.1).
 * Returns all registered provider manifests for the Integration Control Center.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAllManifests } from "@/modules/integrations/registry/getProviderManifest";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const manifests = getAllManifests();
  return NextResponse.json({
    ok: true,
    data: manifests,
    meta: { timestamp: new Date().toISOString() },
  });
}
