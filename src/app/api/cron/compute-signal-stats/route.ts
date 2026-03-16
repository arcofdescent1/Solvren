import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = env.cronSecret;
  const provided =
    (authHeader?.startsWith("Bearer ") && authHeader.slice(7)) ??
    req.headers.get("x-cron-secret") ??
    "";

  if (cronSecret && provided !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client not configured (SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const { error } = await supabase.rpc("compute_signal_statistics");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    org_id: "00000000-0000-0000-0000-000000000000",
    actor_id: null,
    action: "learning_recompute_cron",
    entity_type: "learning",
    entity_id: null,
    metadata: { window_days: 14 },
  });

  return NextResponse.json({ ok: true });
}
