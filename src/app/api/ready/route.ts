/**
 * Lightweight readiness check for load balancers and CI (e.g. Playwright webServer).
 * Returns 200 when the server process is up — no DB or external deps.
 * Use /api/health for full health including DB.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ready: true }, { status: 200 });
}
