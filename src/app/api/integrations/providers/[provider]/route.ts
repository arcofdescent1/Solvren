/**
 * Phase 1 — GET /api/integrations/providers/:provider (§15.1).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProviderManifest } from "@/modules/integrations/registry/getProviderManifest";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { provider } = await params;
  const manifest = getProviderManifest(provider);
  if (!manifest) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Unknown provider" } },
      { status: 404 }
    );
  }
  return NextResponse.json({
    ok: true,
    data: manifest,
    meta: { timestamp: new Date().toISOString() },
  });
}
