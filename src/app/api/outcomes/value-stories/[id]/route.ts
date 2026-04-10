import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission, requireVerifiedUser } from "@/lib/server/authz";

/**
 * GET /api/outcomes/value-stories/[id]
 */
export async function GET(_req: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await routeContext.params;
    const session = await requireVerifiedUser();
    const { data: story, error } = await session.supabase
      .from("value_stories")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireOrgPermission((story as { org_id: string }).org_id, "change.approve");
    return NextResponse.json({ story });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
