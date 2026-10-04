import { timingSafeEqual } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/admin";
import { processLangfusePage } from "@/lib/process-langfuse";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function cleanObjects(db: ReturnType<typeof adminSupabase>) {
  const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await db.from("import_jobs").update({ status: "failed", error_message: "Import staging timed out" })
    .eq("status", "preparing").lt("created_at", stale);
  const [{ data: processed }, { data: failedJobs }] = await Promise.all([
    db.from("import_chunk_objects").select("job_id,object_path,processed_at")
      .is("deleted_at", null).not("processed_at", "is", null).limit(100),
    db.from("import_jobs").select("id").eq("status", "failed").limit(100),
  ]);
  const { data: failedObjects } = failedJobs?.length
    ? await db.from("import_chunk_objects").select("job_id,object_path,processed_at")
      .is("deleted_at", null).in("job_id", failedJobs.map((job) => job.id)).limit(100)
    : { data: [] };
  const objects = [...new Map([...(processed ?? []), ...(failedObjects ?? [])]
    .map((item) => [item.object_path, item] as const)).values()];
  if (!objects.length) return;
  const ids = [...new Set(objects.map((item) => item.job_id))];
  const { data: jobs } = await db.from("import_jobs").select("id,status").in("id", ids);
  const states = new Map((jobs ?? []).map((job) => [job.id, job.status]));
  for (const object of objects) {
    if (!object.processed_at && states.get(object.job_id) !== "failed") continue;
    const { error } = await db.storage.from("margin-imports").remove([object.object_path]);
    if (!error) await db.rpc("mark_import_object_deleted", {
      p_job: object.job_id, p_path: object.object_path,
    });
  }
}

async function runWorker(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let db: ReturnType<typeof adminSupabase>;
  try { db = adminSupabase(); }
  catch { return Response.json({ error: "Worker is not configured" }, { status: 503 }); }
  let processed = 0;
  let failures = 0;
  const until = Date.now() + 35_000;
  while (processed + failures < 20 && Date.now() < until) {
    const { data, error } = await db.rpc("claim_import_chunk");
    if (error) return Response.json({ error: "Queue read failed", processed, failures }, { status: 503 });
    const claim = data?.[0] as { message_id: number; read_count: number; job_id: string; object_path: string } | undefined;
    if (!claim) break;
    let failure = "Import processing failed";
    try {
      if (!claim.object_path) {
        failure = "Langfuse sync failed";
        await processLangfusePage(db, claim);
        processed++;
        continue;
      }
      const { data: blob, error: downloadError } = await db.storage.from("margin-imports").download(claim.object_path);
      if (downloadError || !blob) { failure = "Staged import file is unavailable"; throw new Error(failure); }
      const rows: unknown = JSON.parse(await blob.text());
      if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) {
        failure = "Staged import chunk is invalid";
        throw new Error(failure);
      }
      const { error: applyError } = await db.rpc("apply_import_chunk", { p_job: claim.job_id, p_rows: rows });
      if (applyError) { failure = "Validated rows failed database checks"; throw applyError; }
      const { error: finishError } = await db.rpc("complete_import_chunk", {
        p_message: claim.message_id, p_job: claim.job_id,
      });
      if (finishError) { failure = "Could not finalize import chunk"; throw finishError; }
      processed++;
    } catch (error) {
      failures++;
      if (!claim.object_path && error instanceof Error
        && /^(Langfuse request failed with status [45]\d\d|Langfuse cursor did not advance|Langfuse connection is unavailable)$/.test(error.message))
        failure = error.message;
      await db.rpc("fail_import_chunk", {
        p_message: claim.message_id, p_job: claim.job_id,
        p_error: failure, p_read_count: claim.read_count,
      });
    }
  }
  await cleanObjects(db);
  return Response.json({ processed, failures });
}

export const GET = runWorker;
export const POST = runWorker;
