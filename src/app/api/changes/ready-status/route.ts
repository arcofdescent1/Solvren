import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getReadyStatus } from "@/services/risk/readyStatus";
import { validateChange, getReadinessChecks } from "@/services/changeValidation";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const changeId = url.searchParams.get("changeId");
  const mode = url.searchParams.get("mode"); // "submit" = submission readiness for DRAFT

  if (!changeId)
    return NextResponse.json({ error: "Missing changeId" }, { status: 400 });

  const { data: memberships, error: memErr } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id);

  if (memErr)
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  const orgIds = (memberships ?? []).map((m) => m.org_id);

  const { data: ce, error: ceErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, status"))
    .eq("id", changeId)
    .maybeSingle();

  if (ceErr)
    return NextResponse.json({ error: ceErr.message }, { status: 500 });
  if (!ce || !orgIds.includes(ce.org_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = (ce as { status?: string }).status ?? "DRAFT";
  const isDraftOrReady = status === "DRAFT" || status === "READY";

  // For DRAFT/READY, return submission readiness via validation engine
  if (isDraftOrReady && (mode === "submit" || !mode)) {
    try {
      const validation = await validateChange({
        changeId,
        supabase,
        requireAssessment: true,
      });
      const changeRow = await scopeActiveChangeEvents(supabase.from("change_events").select("domain"))
        .eq("id", changeId)
        .single();
      const domain = (changeRow.data as { domain?: string } | null)?.domain ?? "REVENUE";
      const readinessChecks = getReadinessChecks(validation);
      return NextResponse.json({
        ok: true,
        changeId,
        ready: validation.ready,
        domain,
        bucket: null,
        missingEvidence: [],
        missingApprovalAreas: [],
        missingApprovals: [],
        blockingIncidents: [],
        submissionIssues: validation.errors.map((i) => i.message),
        validationResult: {
          ready: validation.ready,
          issues: validation.issues,
          errors: validation.errors,
          warnings: validation.warnings,
        },
        readinessChecks,
        mode: "submit",
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "readiness failed" },
        { status: 500 }
      );
    }
  }

  try {
    const s = await getReadyStatus(supabase, { changeId });
    return NextResponse.json({ ok: true, changeId, ...s, submissionIssues: [], mode: "approval" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ready-status failed" },
      { status: 500 }
    );
  }
}
