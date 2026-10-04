import { timingSafeEqual } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(secret); const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Database = ReturnType<typeof adminSupabase>;

async function collectObjects(db: Database, bucket: string, prefix: string, limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error("Could not inspect private Storage objects");
  const found: string[] = [];
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) found.push(path);
    else found.push(...await collectObjects(db, bucket, path, limit - found.length));
    if (found.length >= limit) break;
  }
  return found;
}

async function purgeOrganization(db: Database, orgId: string) {
  for (const bucket of ["margin-imports", "margin-reports"]) {
    const paths = await collectObjects(db, bucket, orgId, 200);
    for (let offset = 0; offset < paths.length; offset += 100) {
      const { error } = await db.storage.from(bucket).remove(paths.slice(offset, offset + 100));
      if (error) throw new Error("Could not remove private Storage objects");
    }
    const { data, error } = await db.storage.from(bucket).list(orgId, { limit: 1 });
    if (error) throw new Error("Could not verify private Storage deletion");
    if (data?.length) return false;
  }
  const { error } = await db.from("organizations").delete().eq("id", orgId)
    .lte("purge_after", new Date().toISOString());
  if (error) throw new Error("Could not delete organization data");
  return true;
}

async function runWorker(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let db: Database;
  try { db = adminSupabase(); }
  catch { return Response.json({ error: "Worker is not configured" }, { status: 503 }); }
  const { data: deleted, error: retentionError } = await db.rpc("prune_expired_source_data", { p_limit: 2000 });
  if (retentionError) return Response.json({ error: "Source retention failed" }, { status: 503 });
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: abandoned, error: abandonedError } = await db.from("report_snapshots")
    .select("id,org_id").eq("status", "preparing").lt("created_at", cutoff).limit(20);
  if (abandonedError) return Response.json({ error: "Report cleanup unavailable" }, { status: 503 });
  for (const report of abandoned ?? []) {
    const prefix = `${report.org_id}/${report.id}`;
    const { error: removeError } = await db.storage.from("margin-reports")
      .remove([`${prefix}/report.csv`, `${prefix}/report.pdf`]);
    if (removeError) return Response.json({ error: "Report cleanup needs retry" }, { status: 503 });
    const { error: updateError } = await db.from("report_snapshots")
      .update({ status: "failed" }).eq("id", report.id).eq("status", "preparing");
    if (updateError) return Response.json({ error: "Report cleanup needs retry" }, { status: 503 });
  }
  const { data: due, error: dueError } = await db.from("organizations").select("id")
    .not("purge_after", "is", null).lte("purge_after", new Date().toISOString()).limit(2);
  if (dueError) return Response.json({ error: "Deletion queue unavailable" }, { status: 503 });
  let purged = 0; let pending = 0;
  try {
    for (const org of due ?? []) {
      if (await purgeOrganization(db, org.id)) purged++;
      else pending++;
    }
  } catch { return Response.json({ error: "Organization purge needs retry", purged, pending }, { status: 503 }); }
  return Response.json({ retention: deleted?.[0] ?? null, purged, pending });
}

export const GET = runWorker;
export const POST = runWorker;
