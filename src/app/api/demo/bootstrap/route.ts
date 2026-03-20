/**
 * Phase 8 — POST /api/demo/bootstrap.
 * Marks an org as demo and optionally launches a scenario.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { bootstrapDemoOrg } from "@/modules/demo/services/demo-org-bootstrap.service";

type Body = {
  orgId?: string;
  scenarioKey?: string;
  launchScenario?: boolean;
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // ignore
  }

  let orgId = body.orgId;
  if (!orgId) {
    const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
    orgId = activeOrgId ?? undefined;
  }
  if (!orgId) {
    return NextResponse.json({ error: "orgId required (or set active org)" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await bootstrapDemoOrg(admin, {
    orgId,
    scenarioKey: body.scenarioKey,
    launchScenario: body.launchScenario ?? !!body.scenarioKey,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    orgId,
    isDemoOrg: true,
    scenarioKey: body.scenarioKey ?? null,
  });
}
