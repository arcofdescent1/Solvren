/**
 * Phase 3 — GET /api/admin/signals/definitions (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listSignalDefinitions } from "@/modules/signals/persistence/signal-definitions.repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const url = new URL(req.url);
  const { data, error } = await listSignalDefinitions(supabase, {
    category: url.searchParams.get("category") ?? undefined,
    enabled: url.searchParams.get("enabled") === "true" ? true : url.searchParams.get("enabled") === "false" ? false : undefined,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data, meta: { timestamp: new Date().toISOString() } });
}
