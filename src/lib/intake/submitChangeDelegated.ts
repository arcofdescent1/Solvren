/**
 * Phase 3 — Reuse the authenticated /api/changes/submit pipeline (no duplicated governance logic).
 */
export async function submitChangeDelegated(args: {
  requestUrl: string;
  cookieHeader: string | null;
  changeEventId: string;
}): Promise<{ ok: boolean; status: number; json: unknown }> {
  const base = new URL(args.requestUrl).origin;
  const resp = await fetch(`${base}/api/changes/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(args.cookieHeader ? { Cookie: args.cookieHeader } : {}),
    },
    body: JSON.stringify({ changeEventId: args.changeEventId }),
  });
  const json = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, json };
}
