import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requestOrgWriteRole, requestUser } from "@/lib/api";
import { createImportJob } from "@/lib/import-job";
import { ImportKind, parseImportCsv } from "@/lib/import-schemas";

const kindSchema = z.enum(["usage", "outcomes", "direct_costs", "contracts", "statements"]);
const sourceSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  if (!await requestUser()) return jsonError("Sign in with a verified account.", 401);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4_200_000) return jsonError("File exceeds the 4 MB import limit.", 413);
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Invalid upload.", 400);
  const kind = kindSchema.safeParse(form.get("kind"));
  const source = sourceSchema.safeParse(form.get("source"));
  const file = form.get("file");
  if (!kind.success || !source.success || !(file instanceof File) || file.size > 4_000_000)
    return jsonError("Choose a CSV file, import kind, and source ID. Files must be at most 4 MB.", 400);
  const allowed = kind.data === "contracts" || kind.data === "statements"
    ? ["owner", "finance"] as const : ["owner", "engineer"] as const;
  const session = await requestOrgWriteRole(orgId, [...allowed]);
  if (!session) return jsonError("Your role and MFA are required for this import.", 403);
  const fileName = file.name.split(/[\\/]/).pop()?.slice(0, 200) || "import.csv";
  let parsed: ReturnType<typeof parseImportCsv>;
  try { parsed = parseImportCsv(await file.text(), kind.data as ImportKind); }
  catch (error) { return jsonError(error instanceof Error ? error.message : "Could not parse CSV.", 400); }

  if (kind.data === "contracts" || kind.data === "statements") {
    if (parsed.rejected.length) return NextResponse.json({ error: "Fix all invalid financial rows before importing.",
      rejected: parsed.rejected }, { status: 422 });
    if (kind.data === "contracts") {
      const rows = [...parsed.accepted].sort((a, b) =>
        String(a.customerId).localeCompare(String(b.customerId))
        || String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
      const { data, error } = await session.supabase.rpc("import_contract_versions", {
        p_org: orgId, p_rows: rows,
      });
      if (error) return jsonError(error.message, 422);
      return NextResponse.json({ imported: data });
    }
    const { data, error } = await session.supabase.rpc("import_provider_statements", {
      p_org: orgId, p_file: fileName, p_rows: parsed.accepted,
    });
    if (error) return jsonError(error.message, 422);
    return NextResponse.json({ imported: data });
  }

  try {
    const jobId = await createImportJob({
      orgId, userId: session.user.id, kind: kind.data, source: source.data,
      fileName, totalRows: parsed.totalRows, rows: parsed.accepted, rejected: parsed.rejected,
    });
    return NextResponse.json({ jobId, accepted: parsed.accepted.length,
      rejected: parsed.rejected.length }, { status: 202 });
  } catch {
    return jsonError("Import status is uncertain. Check import activity before retrying; stable event IDs prevent double counting.", 503);
  }
}
