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
 * GET /api/predictions?orgId=&status=&prediction_type=&release_id=&domain=&cursor=&limit=
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orgParam = url.searchParams.get("orgId");
    const ctx = orgParam
      ? await requireOrgPermission(parseRequestedOrgId(orgParam), "change.approve")
      : await requireOrgPermission((await resolveDefaultOrgForUser()).orgId, "change.approve");

    const { supabase, orgId } = ctx;
    const status = url.searchParams.get("status") ?? "ACTIVE";
    const predictionType = url.searchParams.get("prediction_type");
    const releaseId = url.searchParams.get("release_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const domain = url.searchParams.get("domain");
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT))
    );
    const cursor = url.searchParams.get("cursor");

    let domainChangeIds: string[] | null = null;
    if (domain) {
      const { data: ce } = await supabase
        .from("change_events")
        .select("id")
        .eq("org_id", orgId)
        .eq("domain", domain);
      domainChangeIds = (ce ?? []).map((r) => (r as { id: string }).id);
      if (domainChangeIds.length === 0) {
        return NextResponse.json({ orgId, items: [], nextCursor: null });
      }
    }

    let releaseChangeIds: string[] | null = null;
    if (releaseId) {
      const { data: rcs } = await supabase
        .from("release_changes")
        .select("change_event_id")
        .eq("release_id", releaseId);
      releaseChangeIds = (rcs ?? []).map((r) => (r as { change_event_id: string }).change_event_id);
      if (releaseChangeIds.length === 0) {
        return NextResponse.json({ orgId, items: [], nextCursor: null });
      }
    }

    let q = supabase
      .from("predicted_risk_events")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (status) q = q.eq("status", status);
    if (predictionType) q = q.eq("prediction_type", predictionType);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    if (cursor) {
      try {
        const { t } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { t: string };
        if (t) q = q.lt("created_at", t);
      } catch {
        /* ignore */
      }
    }

    if (domainChangeIds) q = q.in("change_event_id", domainChangeIds);
    if (releaseChangeIds) q = q.in("change_event_id", releaseChangeIds);

    const { data: rows, error } = await q;
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
