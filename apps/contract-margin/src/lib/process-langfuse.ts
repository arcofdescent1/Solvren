import "server-only";
import { z } from "zod";
import { adminSupabase } from "@/lib/supabase/admin";
import { langfuseRegions, normalizeLangfuseObservation } from "@/lib/langfuse";

const credentials = z.strictObject({
  publicKey: z.string(), secretKey: z.string(), region: z.enum(["us", "eu", "jp", "hipaa_us"]),
});
const pageSchema = z.object({
  data: z.array(z.unknown()).max(500),
  meta: z.object({ cursor: z.string().nullable().optional() }),
});

export async function processLangfusePage(
  db: ReturnType<typeof adminSupabase>,
  claim: { message_id: number; job_id: string },
) {
  const { data: job, error: jobError } = await db.from("import_jobs")
    .select("org_id,source,configuration,total_rows").eq("id", claim.job_id).single();
  if (jobError || !job) throw new Error("Langfuse job cannot be read");
  const provider = job.source === "langfuse_openai" ? "openai"
    : job.source === "langfuse_anthropic" ? "anthropic" : null;
  if (!provider) throw new Error("Langfuse provider is invalid");
  const { data: secret, error: secretError } = await db.rpc("read_connector_credential_for_worker", {
    p_org: job.org_id, p_provider: job.source,
  });
  if (secretError || !secret) throw new Error("Langfuse connection is unavailable");
  const auth = credentials.parse(JSON.parse(secret));
  const config = z.object({ from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }), cursor: z.string().optional() })
    .parse(job.configuration);
  const url = new URL("/api/public/v2/observations", langfuseRegions[auth.region]);
  url.searchParams.set("fields", "core,basic,model,usage,trace_context");
  url.searchParams.set("limit", "500");
  url.searchParams.set("fromStartTime", config.from);
  url.searchParams.set("toStartTime", config.to);
  if (config.cursor) url.searchParams.set("cursor", config.cursor);
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${auth.publicKey}:${auth.secretKey}`).toString("base64")}` },
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Langfuse request failed with status ${response.status}`);
  const page = pageSchema.parse(await response.json());
  const nextCursor = page.meta.cursor ?? null;
  if (nextCursor && nextCursor === config.cursor) throw new Error("Langfuse cursor did not advance");
  const rows: Record<string, unknown>[] = [];
  const rejected: Array<{ job_id: string; row_number: number; reason: string }> = [];
  let relevant = 0;
  for (const raw of page.data) {
    const result = normalizeLangfuseObservation(raw, provider);
    if ("skipped" in result) continue;
    relevant++;
    if (result.row) rows.push(result.row);
    else rejected.push({ job_id: claim.job_id,
      row_number: Number(job.total_rows) + relevant + 1,
      reason: result.error ?? "Observation is invalid" });
  }
  if (rows.length) {
    const { error } = await db.rpc("apply_import_chunk", { p_job: claim.job_id, p_rows: rows });
    if (error) throw new Error("Langfuse rows failed database checks");
  }
  if (rejected.length) {
    const { error } = await db.from("import_rejections")
      .upsert(rejected, { onConflict: "job_id,row_number", ignoreDuplicates: true });
    if (error) throw new Error("Could not record Langfuse import errors");
  }
  const { error: finishError } = await db.rpc("complete_langfuse_page", {
    p_message: claim.message_id, p_job: claim.job_id,
    p_next_cursor: nextCursor, p_page_rows: relevant, p_rejected: rejected.length,
  });
  if (finishError) throw new Error("Could not checkpoint Langfuse cursor");
}
