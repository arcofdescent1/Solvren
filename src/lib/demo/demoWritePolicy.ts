import type { NextRequest } from "next/server";

/**
 * Phase 5 — demo org: explicit allowlist for mutating requests. GET/HEAD/OPTIONS always pass.
 * Slack / webhooks must never be blocked (return 200 from route handlers).
 */
export function isDemoWriteAllowedRequest(request: NextRequest): boolean {
  const m = request.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return true;

  const p = request.nextUrl.pathname;

  if (m === "POST") {
    if (p.startsWith("/api/auth")) return true;
    if (p.match(/^\/api\/integrations\/[^/]+\/webhook/)) return true;
    if (p === "/api/integrations/slack/actions" || p.startsWith("/api/integrations/slack/interactions")) return true;
    if (p === "/api/slack/actions" || p.startsWith("/api/slack/actions/")) return true;
    if (p.startsWith("/api/health")) return true;
    return false;
  }

  return false;
}
