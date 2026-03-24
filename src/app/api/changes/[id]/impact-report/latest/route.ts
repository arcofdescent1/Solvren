/**
 * @deprecated Use GET /api/changes/[id]/revenue-impact instead (canonical).
 * Redirects to the canonical endpoint for backward compatibility.
 */
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const url = new URL(req.url);
  const base = url.origin;
  const redirectUrl = `${base}/api/changes/${changeId}/revenue-impact`;
  return NextResponse.redirect(redirectUrl, 308);
}
