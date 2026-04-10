/**
 * Phase 3 — Single integration-uploads path for CSV + XLSX (shared with /api/integrations/csv/upload).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "integration-uploads";

export async function storeIntegrationFileUpload(
  admin: SupabaseClient,
  args: {
    orgId: string;
    userId: string;
    buffer: Buffer;
    filename: string;
    contentType: string;
    rowCount: number;
  }
): Promise<{ id: string; storagePath: string; filename: string; row_count: number; created_at: string }> {
  const safeName = args.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${args.orgId}/csv/${Date.now()}-${safeName}`;

  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, args.buffer, {
    contentType: args.contentType,
    upsert: false,
  });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data: uploadRow, error: insertErr } = await admin
    .from("integration_file_uploads")
    .insert({
      org_id: args.orgId,
      integration_account_id: null,
      storage_path: path,
      filename: args.filename,
      content_type: args.contentType,
      row_count: args.rowCount,
      status: "uploaded",
      uploaded_by: args.userId,
    })
    .select("id, filename, row_count, created_at")
    .single();

  if (insertErr || !uploadRow) throw new Error(insertErr?.message ?? "insert failed");
  const r = uploadRow as {
    id: string;
    filename: string;
    row_count: number;
    created_at: string;
  };
  return {
    id: r.id,
    storagePath: path,
    filename: r.filename,
    row_count: r.row_count,
    created_at: r.created_at,
  };
}

export async function downloadIntegrationUpload(
  admin: SupabaseClient,
  storagePath: string
): Promise<Buffer> {
  const { data, error } = await admin.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "download failed");
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}
