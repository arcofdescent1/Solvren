import { NextResponse } from "next/server";
import { z } from "zod";
import { createImportJob } from "@/lib/import-job";
import { validateRows } from "@/lib/import-schemas";
import { adminSupabase } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

const payload = z.strictObject({
  kind: z.enum(["usage", "outcomes", "direct_costs"]),
  source: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  rows: z.array(z.unknown()).min(1).max(500),
});

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return jsonError("Use a Solvren ingestion key.", 401);
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000)
    return jsonError("Batch exceeds 1 MB.", 413);
  const parsed = payload.safeParse(await boundedJson(request, 1_000_000).catch(() => null));
  if (!parsed.success) return jsonError("Send 1–500 metadata-only event rows.", 400);
  let db: ReturnType<typeof adminSupabase>;
  try { db = adminSupabase(); }
  catch { return jsonError("Ingestion service is not configured.", 503); }
  const { data: keyContext, error: authorizationError } = await db.rpc("authorize_ingestion_key", { p_token: token });
  if (authorizationError?.message.includes("rate limit")) return jsonError("Ingestion rate limit exceeded.", 429);
  const key = keyContext?.[0] as { org_id: string; created_by: string } | undefined;
  if (authorizationError || !key) return jsonError("Invalid or revoked ingestion key.", 401);
  const checked = validateRows(parsed.data.kind, parsed.data.rows);
  if (checked.rejected.length) return NextResponse.json({
    error: "Batch contains invalid rows. No events were queued.", rejected: checked.rejected,
  }, { status: 422 });
  try {
    const jobId = await createImportJob({
      orgId: key.org_id, userId: key.created_by, kind: parsed.data.kind,
      source: parsed.data.source, totalRows: checked.accepted.length,
      rows: checked.accepted, rejected: [],
    });
    return NextResponse.json({ jobId, accepted: checked.accepted.length }, { status: 202 });
  } catch {
    return jsonError("Events could not be queued. Retry with the same event IDs.", 503);
  }
}
