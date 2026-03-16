import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Single auth pattern for all scheduled job routes.
 * Requires CRON_SECRET via Authorization: Bearer <secret> or x-cron-secret header.
 * Returns 401 JSON response if unauthorized; returns null if authorized.
 */
export function requireCronSecret(req: Request): NextResponse | null {
  const cronSecret = env.cronSecret;
  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");
  const provided =
    (authHeader?.startsWith("Bearer ") && authHeader.slice(7)) ??
    cronHeader ??
    "";

  if (!cronSecret || provided !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
