import type { SupabaseClient } from "@supabase/supabase-js";

export const GENERATED_REPORTS_BUCKET = "generated-reports";

export function reportStoragePath(args: {
  orgId: string;
  reportType: string;
  reportId: string;
  ext: string;
}): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const safeType = args.reportType.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `reports/${args.orgId}/${safeType}/${y}/${m}/${args.reportId}.${args.ext}`;
}

export async function uploadReportObject(
  admin: SupabaseClient,
  args: { path: string; body: Buffer; contentType: string }
): Promise<{ error: string | null }> {
  const { error } = await admin.storage.from(GENERATED_REPORTS_BUCKET).upload(args.path, args.body, {
    contentType: args.contentType,
    upsert: true,
  });
  return { error: error?.message ?? null };
}

export async function createSignedReportUrl(
  admin: SupabaseClient,
  storagePath: string,
  expiresSec = 604800
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await admin.storage
    .from(GENERATED_REPORTS_BUCKET)
    .createSignedUrl(storagePath, expiresSec);
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}
