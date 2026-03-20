/**
 * Phase 0 — Issue APIs: get by id.
 * Phase 1 Gap 1 — Full context: entities, signals, evidence, lineage.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return membership?.org_id ?? null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getIssueDetail(supabase, issueId);
  if (result.error)
    return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.issue)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const i = result.issue;
  if (i.org_id !== orgId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [entitiesRes, signalLinksRes, evidenceRes, lineageRes, changesRes, sourceRes] = await Promise.all([
    supabase.from("issue_entities").select("entity_type, canonical_entity_id, external_system, external_id, entity_display_name, role, confidence").eq("issue_id", issueId),
    supabase.from("issue_signal_links").select("signal_id, relevance_score").eq("issue_id", issueId),
    supabase.from("issue_evidence").select("evidence_type, evidence_key, payload_json, confidence").eq("issue_id", issueId).order("created_at", { ascending: true }),
    supabase.from("issue_lineage").select("source_type, source_ref, metadata_json").eq("issue_id", issueId).order("created_at", { ascending: true }),
    supabase.from("change_issue_links").select("change_id, link_type").eq("issue_id", issueId),
    supabase.from("issue_sources").select("evidence_json").eq("issue_id", issueId).limit(1).maybeSingle(),
  ]);

  const entities = (entitiesRes.data ?? []).map((e: { entity_type: string; canonical_entity_id: string | null; external_system: string | null; external_id: string | null; entity_display_name: string | null; role: string | null; confidence: number }) => ({
    entityType: e.entity_type,
    entityId: e.canonical_entity_id,
    externalSystem: e.external_system,
    externalId: e.external_id,
    displayName: e.entity_display_name,
    role: e.role ?? "related",
    confidence: e.confidence,
  }));

  const signals = (signalLinksRes.data ?? []).map((s: { signal_id: string; relevance_score: number }) => ({
    signalId: s.signal_id,
    relevanceScore: s.relevance_score,
  }));

  const evidence = (evidenceRes.data ?? []).map((e: { evidence_type: string; evidence_key: string; payload_json: unknown; confidence: number | null }) => ({
    evidenceType: e.evidence_type,
    evidenceKey: e.evidence_key,
    payload: e.payload_json,
    confidence: e.confidence,
  }));

  const lineage = (lineageRes.data ?? []).map((l: { source_type: string; source_ref: string; metadata_json: unknown }) => ({
    sourceType: l.source_type,
    sourceRef: l.source_ref,
    metadata: l.metadata_json,
  }));

  const changes = (changesRes.data ?? []).map((c: { change_id: string; link_type: string }) => ({
    changeId: c.change_id,
    linkType: c.link_type,
  }));

  const issueRow = i as { detector_key?: string | null; primary_entity_id?: string | null; issue_type?: string | null; issue_subtype?: string | null; issue_confidence?: number | null };
  const evidenceJson = sourceRes.data?.evidence_json as Record<string, unknown> | undefined;

  return NextResponse.json({
    id: i.id,
    issueKey: i.issue_key,
    sourceType: i.source_type,
    sourceRef: i.source_ref,
    domainKey: i.domain_key,
    title: i.title,
    description: i.description,
    summary: i.summary,
    status: i.status,
    verificationStatus: i.verification_status,
    severity: i.severity,
    priorityScore: i.priority_score,
    impactScore: i.impact_score,
    confidenceScore: i.confidence_score,
    detectorKey: issueRow.detector_key ?? null,
    primaryEntityId: issueRow.primary_entity_id ?? null,
    issueType: issueRow.issue_type ?? null,
    issueSubtype: issueRow.issue_subtype ?? null,
    issueConfidence: issueRow.issue_confidence ?? null,
    owner: {
      userId: i.owner_user_id,
      teamKey: i.owner_team_key,
    },
    impact: null,
    links: { changes, entities: entities.map((e) => ({ entityType: e.entityType, externalSystem: e.externalSystem, externalId: e.externalId, displayName: e.displayName, entityId: e.entityId, role: e.role, confidence: e.confidence })), tasks: [] },
    entities,
    signals,
    evidence,
    lineage,
    evidenceJson: evidenceJson ?? null,
    timestamps: {
      openedAt: i.opened_at,
      updatedAt: i.updated_at,
      triagedAt: i.triaged_at,
      assignedAt: i.assigned_at,
      inProgressAt: i.in_progress_at,
      resolvedAt: i.resolved_at,
      verifiedAt: i.verified_at,
      dismissedAt: i.dismissed_at,
    },
  });
}
