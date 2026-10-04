import "server-only";
import { adminSupabase } from "@/lib/supabase/admin";

type Rejection = { row_number: number; reason: string };
type Kind = "usage" | "outcomes" | "direct_costs" | "langfuse";

export async function createImportJob(input: {
  orgId: string; userId: string; kind: Kind; source: string; fileName?: string;
  totalRows: number; rows: Record<string, unknown>[]; rejected: Rejection[];
}) {
  const db = adminSupabase();
  const { data: job, error: createError } = await db.from("import_jobs").insert({
    org_id: input.orgId, created_by: input.userId, kind: input.kind,
    source: input.source, file_name: input.fileName ?? null,
    total_rows: input.totalRows, rejected_rows: input.rejected.length,
  }).select("id").single();
  if (createError || !job) throw new Error(createError?.message ?? "Could not create import job");
  const paths: string[] = [];
  try {
    for (let offset = 0; offset < input.rejected.length; offset += 500) {
      const { error } = await db.from("import_rejections").insert(input.rejected.slice(offset, offset + 500)
        .map((item) => ({ ...item, job_id: job.id })));
      if (error) throw error;
    }
    for (let offset = 0; offset < input.rows.length; offset += 500) {
      const path = `${input.orgId}/${job.id}/${offset / 500}.json`;
      const body = JSON.stringify(input.rows.slice(offset, offset + 500));
      const { error } = await db.storage.from("margin-imports").upload(path, body, {
        contentType: "application/json", upsert: false,
      });
      if (error) throw error;
      paths.push(path);
      const { error: trackingError } = await db.from("import_chunk_objects")
        .insert({ job_id: job.id, object_path: path });
      if (trackingError) throw trackingError;
    }
    if (paths.length) {
      const { error } = await db.rpc("queue_import_chunks", { p_job: job.id, p_paths: paths });
      if (error) throw error;
    } else {
      const { error } = await db.from("import_jobs").update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", job.id);
      if (error) throw error;
    }
    return job.id as string;
  } catch (error) {
    const { data: current } = await db.from("import_jobs").select("status").eq("id", job.id).maybeSingle();
    if (current?.status === "preparing") {
      if (paths.length) await db.storage.from("margin-imports").remove(paths);
      await db.from("import_jobs").update({ status: "failed",
        error_message: "Could not stage import", updated_at: new Date().toISOString() }).eq("id", job.id);
    }
    throw error;
  }
}
