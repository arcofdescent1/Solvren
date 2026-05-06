import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { hashIssueActionToken } from "@/lib/issues/issueActionToken";
import { executeIssueWorkflowAction, type IssueWorkflowActionType } from "@/lib/issues/executeIssueWorkflowAction";

function parseEmailActionParam(raw: string | null): IssueWorkflowActionType | null {
  const a = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const allowed: IssueWorkflowActionType[] = [
    "acknowledge",
    "dismiss",
    "assign",
    "approve",
    "deny",
    "request_changes",
    "mark_in_progress",
    "resolve",
    "reopen",
  ];
  return allowed.includes(a as IssueWorkflowActionType) ? (a as IssueWorkflowActionType) : null;
}

function redirectComplete(state: string) {
  const base = env.appUrl.replace(/\/$/, "");
  return NextResponse.redirect(`${base}/action-complete?state=${encodeURIComponent(state)}`, 302);
}

/**
 * Phase 2 — one-click email links using hashed `action_tokens` rows.
 * Query: `token` (raw secret), `action` (must match stored action_type).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawToken = url.searchParams.get("token")?.trim();
  const actionParam = parseEmailActionParam(url.searchParams.get("action"));
  if (!rawToken || !actionParam) {
    return redirectComplete("invalid");
  }

  const admin = createAdminClient();
  const token_hash = hashIssueActionToken(rawToken);

  const { data: row, error } = await admin
    .from("action_tokens")
    .select("id, action_type, expires_at, used_at, recipient_email, issue_id")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (error || !row) {
    return redirectComplete("invalid");
  }

  if ((row as { used_at?: string | null }).used_at) {
    return redirectComplete("used");
  }

  const exp = (row as { expires_at?: string }).expires_at;
  if (exp && Date.parse(exp) < Date.now()) {
    return redirectComplete("expired");
  }

  const storedAction = String((row as { action_type?: string }).action_type ?? "").trim();
  if (storedAction !== actionParam) {
    return redirectComplete("mismatch");
  }

  if (actionParam === "assign") {
    return redirectComplete("invalid");
  }

  const issueId = (row as { issue_id: string }).issue_id;
  const recipient = (row as { recipient_email?: string | null }).recipient_email ?? null;

  const result = await executeIssueWorkflowAction(admin, {
    issueId,
    actorUserId: null,
    actorEmail: recipient,
    actorDisplayName: null,
    source: "email",
    action: actionParam,
    payload: {},
  });

  if (!result.ok) {
    return redirectComplete("error");
  }

  await admin
    .from("action_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", (row as { id: string }).id);

  return redirectComplete("success");
}
