import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { runValueEngineDetectionPass } from "@/lib/value-engine/runValueEngineCron";

export async function POST(_req: NextRequest) {
  const authHeader = _req.headers.get("authorization");
  if (env.cronSecret && authHeader !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  await runValueEngineDetectionPass(admin);
  return NextResponse.json({ ok: true });
}
