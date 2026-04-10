import { NextRequest, NextResponse } from "next/server";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
  resolveDefaultOrgForUser,
} from "@/lib/server/authz";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * GET /api/outcomes/value-stories?orgId=&from=&to=&domain=&outcome_type=&confidence_level=&status=&cursor=&limit=
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const orgParam = url.searchParams.get("orgId");
    const ctx = orgParam
      ? await requireOrgPermission(parseRequestedOrgId(orgParam), "change.approve")
      : await requireOrgPermission((await resolveDefaultOrgForUser()).orgId, "change.approve");

    const { supabase, orgId } = ctx;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const domain = url.searchParams.get("domain");
    const outcomeType = url.searchParams.get("outcome_type");
    const confidenceLevel = url.searchParams.get("confidence_level");
    const status = url.searchParams.get("status");
    const team = url.searchParams.get("team");
    const domainFilter = domain ?? team;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT))
    );
    const cursor = url.searchParams.get("cursor");

    let changeIds: string[] | null = null;
    if (domainFilter) {
      let q = supabase.from("change_events").select("id").eq("org_id", orgId);
      q = q.eq("domain", domainFilter);
      const { data: ce } = await q;
      changeIds = (ce ?? []).map((r) => (r as { id: string }).id);
      if (changeIds.length === 0) {
        return NextResponse.json({ orgId, items: [], nextCursor: null });
      }
    }

    let query = supabase
      .from("value_stories")
      .select("id, change_event_id, prediction_id, outcome_type, headline, estimated_value, confidence_level, status, created_at, finalized_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);
    if (outcomeType) query = query.eq("outcome_type", outcomeType);
    if (confidenceLevel) query = query.eq("confidence_level", confidenceLevel);
    if (status) query = query.eq("status", status);
    if (changeIds) query = query.in("change_event_id", changeIds);
    if (cursor) {
      try {
        const { t } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { t: string };
        if (t) query = query.lt("created_at", t);
      } catch {
        /* ignore */
      }
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = (rows ?? []).slice(0, limit);
    let nextCursor: string | null = null;
    if ((rows ?? []).length > limit) {
      const last = list[list.length - 1] as { created_at: string; id: string };
      if (last) {
        nextCursor = Buffer.from(JSON.stringify({ t: last.created_at, id: last.id }), "utf8").toString(
          "base64url"
        );
      }
    }

    return NextResponse.json({ orgId, items: list, nextCursor });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
