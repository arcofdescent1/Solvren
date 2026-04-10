import type { ExecutiveDecisionApi } from "./types";

const ALLOWED: ExecutiveDecisionApi[] = ["APPROVE", "DELAY", "ESCALATE", "REQUEST_INFO"];

export function parseExecutiveDecisionBody(raw: unknown): {
  decision: ExecutiveDecisionApi;
  comment?: string | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { decision?: unknown; comment?: unknown };
  const d = o.decision;
  if (typeof d !== "string" || !ALLOWED.includes(d as ExecutiveDecisionApi)) return null;
  const comment =
    o.comment === undefined || o.comment === null
      ? undefined
      : String(o.comment);
  return { decision: d as ExecutiveDecisionApi, comment };
}
