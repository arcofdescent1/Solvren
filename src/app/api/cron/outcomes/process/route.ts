import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { detectValueStoriesForOrg } from "@/lib/outcomes/detectValueStories";
import { detectApprovalTimeSavedForOrg } from "@/lib/outcomes/createApprovalTimeSavedStory";
import { finalizeValueStoriesForOrg } from "@/lib/outcomes/finalizeValueStories";

/** POST /api/cron/outcomes/process — detect + finalize value stories per org */
export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  try {
    const admin = createAdminClient();
    const { data: orgs, error } = await admin.from("organizations").select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let created = 0;
    let approvalSaved = 0;
    let finalized = 0;
    let rejected = 0;
    for (const o of orgs ?? []) {
      const orgId = (o as { id: string }).id;
      const d = await detectValueStoriesForOrg(admin, orgId);
      created += d.created;
      const a = await detectApprovalTimeSavedForOrg(admin, orgId);
      approvalSaved += a.created;
      const f = await finalizeValueStoriesForOrg(admin, orgId);
      finalized += f.finalized;
      rejected += f.rejected;
    }

    return NextResponse.json({ ok: true, created, approvalSaved, finalized, rejected });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "outcomes process failed" },
      { status: 500 }
    );
  }
}
