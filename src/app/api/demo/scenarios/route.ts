/**
 * Phase 8 — GET /api/demo/scenarios (§21.1).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listDemoScenarios } from "@/modules/demo/repositories/demo-scenarios.repository";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await listDemoScenarios(supabase, { status: "active" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    data.map((s) => ({
      scenarioKey: s.scenarioKey,
      displayName: s.displayName,
      description: s.description,
      seedVersion: s.seedVersion,
      metadata: s.metadataJson,
    }))
  );
}
