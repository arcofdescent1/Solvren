/**
 * Phase 1 — Spec redirect path; forwards to the existing OAuth callback handler.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = new URL("/api/integrations/hubspot/oauth/callback", `${url.protocol}//${url.host}`);
  target.search = url.search;
  return NextResponse.redirect(target);
}
