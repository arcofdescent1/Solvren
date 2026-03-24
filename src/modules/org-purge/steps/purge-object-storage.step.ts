import type { OrgPurgeStepContext } from "../step-context";

const BUCKET = "integration-uploads";

export async function runPurgeObjectStorageStep(ctx: OrgPurgeStepContext): Promise<Record<string, unknown>> {
  const prefix = `${ctx.orgId}/`;
  if (ctx.dryRun) {
    return { dryRun: true, bucket: BUCKET, prefix };
  }

  const removed: string[] = [];
  const { data: list, error: listErr } = await ctx.admin.storage.from(BUCKET).list(ctx.orgId, { limit: 1000 });
  if (listErr) {
    return { bucket: BUCKET, prefix, listError: listErr.message, removedCount: 0 };
  }

  for (const obj of list ?? []) {
    const path = `${ctx.orgId}/${obj.name}`;
    const { error: rmErr } = await ctx.admin.storage.from(BUCKET).remove([path]);
    if (!rmErr) removed.push(path);
  }

  const { data: deepCsv, error: csvListErr } = await ctx.admin.storage.from(BUCKET).list(`${ctx.orgId}/csv`, {
    limit: 1000,
  });
  if (!csvListErr) {
    for (const obj of deepCsv ?? []) {
      const path = `${ctx.orgId}/csv/${obj.name}`;
      const { error: rmErr } = await ctx.admin.storage.from(BUCKET).remove([path]);
      if (!rmErr) removed.push(path);
    }
  }

  return { bucket: BUCKET, removedCount: removed.length, pathsSample: removed.slice(0, 20) };
}
