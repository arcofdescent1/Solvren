import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { buildRoiSummary, parseRoiRangeParam } from "@/features/roi/buildRoiSummary";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  const orgId = activeOrgId;

  const rawRange = req.nextUrl.searchParams.get("range");
  const { range } = parseRoiRangeParam(rawRange);

  try {
    const payload = await buildRoiSummary(supabase, orgId, range);
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "roi_summary_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
