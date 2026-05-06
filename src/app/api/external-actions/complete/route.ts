import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistExecutiveDecision } from "@/lib/executive/persistExecutiveDecision";
import { parseExecutiveDecisionBody } from "@/lib/executive/parseDecisionBody";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";
import {
  markExecutiveExternalTokenUsed,
  resolveExecutiveExternalToken,
} from "@/lib/external-actions/executiveActionToken";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = parseExecutiveDecisionBody(raw);
  if (!parsedBody) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const token = typeof o.token === "string" ? o.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const admin = createAdminClient();
  const resolved = await resolveExecutiveExternalToken(admin, token);
  if (!resolved.ok) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const execOk = await isExecutiveUserForPhase1(admin, resolved.userId, resolved.orgId);
  if (!execOk) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() ?? null;

  const result = await persistExecutiveDecision(admin, {
    orgId: resolved.orgId,
    changeId: resolved.changeEventId,
    userId: resolved.userId,
    decision: parsedBody.decision,
    comment: parsedBody.comment ?? null,
    audit: {
      channel: "email",
      tokenId: resolved.id,
      ip,
      userAgent: req.headers.get("user-agent"),
    },
  });

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  await markExecutiveExternalTokenUsed(admin, resolved.id);
  return NextResponse.json({ ok: true });
}
