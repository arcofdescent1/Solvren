import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: orgRow } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!orgRow?.org_id)
    return NextResponse.json({ error: "No org" }, { status: 400 });

  const orgId = orgRow.org_id as string;

  const { data: maxRow } = await supabase
    .from("signal_stats")
    .select("model_version")
    .eq("org_id", orgId)
    .eq("domain", "REVENUE")
    .order("model_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentVersion = Number(maxRow?.model_version ?? 1);

  const body = (await req.json().catch(() => ({}))) as { note?: string };
  const note = body?.note ?? null;

  const { error: insErr } = await supabase.from("risk_model_versions").insert({
    org_id: orgId,
    domain: "REVENUE",
    model_version: currentVersion,
    frozen_by: userRes.user.id,
    note,
    metadata: { type: "freeze" },
  });

  if (insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  const admin = createAdminClient();
  await admin
    .from("signal_stats")
    .update({ baseline_frozen_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("domain", "REVENUE")
    .eq("model_version", currentVersion);

  return NextResponse.json({
    ok: true,
    orgId,
    modelVersion: currentVersion,
  });
}
