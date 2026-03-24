import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { auditLog } from "@/lib/audit";
import { getApprovalRequirementsForChange } from "@/services/domains/approvalRequirements";
import { ensureApprovalsForRequirements } from "@/services/risk/approvals";
import { mitigationForCategory, prettyCategory } from "@/services/risk/mitigations";
import {
  EVIDENCE_KIND_LABEL,
  REQUIRED_EVIDENCE_BY_BUCKET,
  type EvidenceKind,
  type RiskBucket,
} from "@/services/risk/requirements";
import { deriveEvidenceRequirements } from "@/services/evidence";

type ReqBody = { changeEventId: string };

function mdEscapeInline(s: string) {
  return s.replace(/\|/g, "\\|").trim();
}

function buildAiNotesSection(
  passA: unknown
): string[] {
  if (passA == null || typeof passA !== "object") return [];

  const obj = passA as Record<string, unknown>;
  const summary = obj.summary;
  if (summary == null || typeof summary !== "object") return [];

  const summaryObj = summary as Record<string, unknown>;
  const riskNarrative = summaryObj.risk_narrative;
  const keyConcerns = summaryObj.key_concerns;
  const checklistSuggestion = obj.checklist_md_suggestion;

  const lines: string[] = ["", "## AI Notes"];

  if (typeof riskNarrative === "string" && riskNarrative.trim()) {
    lines.push("", riskNarrative.trim());
  }

  if (Array.isArray(keyConcerns) && keyConcerns.length > 0) {
    lines.push("", "**Key concerns:**");
    keyConcerns.forEach((c) => {
      if (typeof c === "string" && c.trim()) lines.push(`- ${c.trim()}`);
    });
  }

  if (typeof checklistSuggestion === "string" && checklistSuggestion.trim()) {
    lines.push("", "### Optional enhancements");
    lines.push(checklistSuggestion.trim());
  }

  return lines.length > 2 ? lines : [];
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternal =
    !!env.cronSecret &&
    internalSecret === env.cronSecret;

  if (!isInternal) {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.changeEventId)
    return NextResponse.json(
      { error: "Missing changeEventId" },
      { status: 400 }
    );

  const db = isInternal ? admin : supabase;
  const { data: change, error: ceErr } = await scopeActiveChangeEvents(db.from("change_events").select(
      "id, org_id, created_by, title, change_type, structured_change_type, status, requested_release_at, created_at, domain, systems_involved, backfill_required, rollout_method, customer_impact_expected"
    ))
    .eq("id", body.changeEventId)
    .single();

  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Change not found" },
      { status: 404 }
    );

  const { data: assessment, error: aErr } = await db
    .from("impact_assessments")
    .select("id, status, risk_score_raw, risk_bucket, pass_a_output, missing_evidence_suggestions, created_at")
    .eq("change_event_id", body.changeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr)
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  if (!assessment?.id)
    return NextResponse.json(
      { error: "No assessment found for change" },
      { status: 400 }
    );

  const { data: signals, error: sErr } = await db
    .from("risk_signals")
    .select(
      "signal_key, category, value_type, value_bool, value_num, source, contribution, weight_at_time"
    )
    .eq("change_event_id", body.changeEventId)
    .order("contribution", { ascending: false });

  if (sErr)
    return NextResponse.json({ error: sErr.message }, { status: 500 });

  const { data: evidence, error: evErr } = await db
    .from("change_evidence")
    .select("kind, label, url")
    .eq("change_event_id", body.changeEventId);

  if (evErr)
    return NextResponse.json({ error: evErr.message }, { status: 500 });

  const bucket = (assessment.risk_bucket ?? null) as RiskBucket | null;
  const changeDomain = (change.domain ?? "REVENUE") as string;
  const riskBucketStr = bucket ?? "MEDIUM";

  const { data: tpl, error: tplErr } = await db
    .from("domain_governance_templates")
    .select("required_evidence_kinds, checklist_sections")
    .eq("domain", changeDomain)
    .eq("risk_bucket", riskBucketStr)
    .eq("enabled", true)
    .maybeSingle();

  if (tplErr)
    return NextResponse.json({ error: tplErr.message }, { status: 500 });

  const requiredEvidence: EvidenceKind[] =
    Array.isArray((tpl as { required_evidence_kinds?: unknown })?.required_evidence_kinds)
      ? ((tpl as { required_evidence_kinds: EvidenceKind[] }).required_evidence_kinds as EvidenceKind[])
      : bucket
        ? ((REQUIRED_EVIDENCE_BY_BUCKET[bucket] ?? []) as EvidenceKind[])
        : [];
  const present = new Set((evidence ?? []).map((e) => e.kind));
  const missing = requiredEvidence.filter((k) => !present.has(k));

  const suggestionsJson = assessment?.missing_evidence_suggestions as
    | { suggestions?: Array<{ kind: string; suggested_label: string }> }
    | null
    | undefined;
  const suggestionLines =
    suggestionsJson?.suggestions && suggestionsJson.suggestions.length > 0
      ? [
          "",
          "### Suggested evidence to attach (AI)",
          ...suggestionsJson.suggestions.slice(0, 6).map((s) => {
            const kind = s.kind as EvidenceKind;
            const kindLabel = EVIDENCE_KIND_LABEL[kind] ?? s.kind;
            return `- ${kindLabel}: ${mdEscapeInline(s.suggested_label)}`;
          }),
        ]
      : [];

  const contributing = (signals ?? []).filter(
    (s) => (s.contribution ?? 0) !== 0
  );

  const totals = new Map<
    string,
    { total: number; items: (typeof contributing)[number][] }
  >();
  for (const s of contributing) {
    const cat = s.category ?? "UNKNOWN";
    const entry = totals.get(cat) ?? { total: 0, items: [] };
    entry.total += Number(s.contribution ?? 0);
    entry.items.push(s);
    totals.set(cat, entry);
  }

  const breakdown = Array.from(totals.entries())
    .map(([category, v]) => ({
      category,
      total: v.total,
      items: [...v.items].sort(
        (a, b) => Number(b.contribution ?? 0) - Number(a.contribution ?? 0)
      ),
    }))
    .sort((a, b) => b.total - a.total);

  const mitigations = breakdown
    .map((g) => ({ g, m: mitigationForCategory(g.category, g.total) }))
    .filter(
      (x): x is typeof x & { m: NonNullable<typeof x.m> } => x.m !== null
    );

  const top = contributing.slice(0, 8);

  const now = new Date().toISOString();

  const { data: approvalReqs } = await supabase
    .from("approval_requirements")
    .select("required_role, min_count")
    .eq("org_id", change.org_id)
    .eq("domain", changeDomain)
    .eq("risk_bucket", riskBucketStr)
    .eq("enabled", true);

  const approvalRequirementsList: { role: string; min: number }[] = (approvalReqs ?? []).map(
    (r) => ({
      role: String(r.required_role),
      min: Number((r as { min_count?: number }).min_count ?? 1),
    })
  );

  const checklistSections: string[] = Array.isArray(
    (tpl as { checklist_sections?: unknown })?.checklist_sections
  )
    ? ((tpl as { checklist_sections: string[] }).checklist_sections as string[])
    : [];
  const checklistSectionsMd =
    checklistSections.length > 0
      ? [
          "",
          "## Checklist sections (policy)",
          ...checklistSections.map((t) => `- [ ] ${mdEscapeInline(String(t))}`),
        ]
      : [];

  const reportMd = [
    `# Change checklist`,
    ``,
    `**Change:** ${mdEscapeInline(change.title)}`,
    ``,
    `- Type: \`${(change as { change_type?: string }).change_type ?? "—"}\``,
    `- Domain: \`${changeDomain}\``,
    `- Status: \`${change.status}\``,
    `- Generated: \`${now}\``,
    `- Risk score: **${assessment.risk_score_raw ?? "—"}** ${assessment.risk_bucket ? `(${assessment.risk_bucket})` : ""}`,
    ``,
    `## Top contributors`,
    top.length === 0
      ? `- (none yet)`
      : top
          .map((s) => {
            const val =
              s.value_type === "BOOLEAN"
                ? String(s.value_bool)
                : String(s.value_num);
            return `- [ ] \`${s.signal_key}\` — **+${s.contribution}** (w=${s.weight_at_time}) • value=${val} • ${prettyCategory(s.category)}`;
          })
          .join("\n"),
    ``,
    `## Signal breakdown`,
    breakdown.length === 0
      ? `- (none yet)`
      : breakdown
          .map((g) => {
            const lines = [
              `### ${prettyCategory(g.category)} (+${g.total})`,
              ...g.items
                .slice(0, 6)
                .map((s) => `- \`${s.signal_key}\` — +${s.contribution}`),
            ];
            if (g.items.length > 6)
              lines.push(`- _(showing 6 of ${g.items.length})_`);
            return lines.join("\n");
          })
          .join("\n\n"),
    ``,
    `## Required evidence`,
    bucket
      ? requiredEvidence.length === 0
        ? `- None required for this risk level.`
        : [
            `Risk bucket: **${bucket}**`,
            ``,
            `**Required kinds:** ${requiredEvidence.map((k) => EVIDENCE_KIND_LABEL[k]).join(", ")}`,
            ``,
            `**Missing:** ${
              missing.length === 0
                ? "None ✅"
                : missing.map((k) => EVIDENCE_KIND_LABEL[k]).join(", ")
            }`,
          ].join("\n")
      : `- (no risk bucket yet)`,
    ...suggestionLines,
    ``,
    `## Mitigation checklist`,
    mitigations.length === 0
      ? `- (no categories exceed mitigation thresholds)`
      : mitigations
          .map(({ m }) => {
            const header = `### ${m.title} (${m.level === "VERY_HIGH" ? "Very high priority" : "High priority"})`;
            const actions = m.actions.map((a) => `- [ ] ${a}`);
            return [header, ...actions].join("\n");
          })
          .join("\n\n"),
    ...checklistSectionsMd,
    ...(buildAiNotesSection(assessment?.pass_a_output)),
    ``,
    `## Approvals required`,
    approvalRequirementsList.length === 0
      ? `- (none from approval_requirements for this domain/risk bucket)`
      : approvalRequirementsList.map(
          (r) => `- [ ] ${mdEscapeInline(r.role)} (x${r.min})`
        ).join("\n"),
    ``,
  ].join("\n");

  let requirementsOverride: { role: string; min: number }[] | undefined;
  try {
    const domainReqs = await getApprovalRequirementsForChange(db, {
      orgId: change.org_id as string,
      domainKey: changeDomain,
    });
    if (domainReqs.length > 0) {
      requirementsOverride = domainReqs.map((r) => ({
        role: r.approvalArea,
        min: r.requiredApprovals,
      }));
    }
  } catch {
    // Fall back to approval_requirements table
  }

  // Task 14: Ensure evidence requirements (derive from change context, upsert items)
  const evidenceReqs = deriveEvidenceRequirements(change as Record<string, unknown>);
  const { data: existingItems } = await db
    .from("change_evidence_items")
    .select("id, kind, status")
    .eq("change_event_id", body.changeEventId);
  const existingByKind = new Map(
    (existingItems ?? []).map((e) => [String(e.kind), e])
  );
  for (const req of evidenceReqs) {
    const existing = existingByKind.get(req.kind);
    if (!existing) {
      await db.from("change_evidence_items").insert({
        change_event_id: body.changeEventId,
        org_id: change.org_id,
        kind: req.kind,
        label: req.label,
        severity: req.severity,
        status: "MISSING",
      });
    } else {
      await db
        .from("change_evidence_items")
        .update({ severity: req.severity, label: req.label })
        .eq("id", existing.id);
    }
  }
  await auditLog(db, {
    orgId: change.org_id as string,
    actorId: isInternal ? String(change.created_by ?? "") : (await supabase.auth.getUser()).data.user?.id ?? "",
    action: "evidence_requirement_generated",
    entityType: "change",
    entityId: body.changeEventId,
    metadata: { count: evidenceReqs.length },
  });

  const { inserted: approvalsInserted } = await ensureApprovalsForRequirements(
    db,
    {
      orgId: change.org_id as string,
      changeId: body.changeEventId,
      domain: changeDomain,
      riskBucket: riskBucketStr,
      isEscalated: false,
      requirementsOverride,
    }
  );

  const { error: updErr } = await db
    .from("impact_assessments")
    .update({ report_md: reportMd })
    .eq("id", assessment.id);

  if (updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 });

  const checklistActorId = isInternal
    ? String(change.created_by ?? "")
    : (await supabase.auth.getUser()).data.user?.id ?? "";
  await auditLog(db, {
    orgId: change.org_id as string,
    actorId: checklistActorId,
    actorType: "USER",
    action: "checklist_generated",
    entityType: "change",
    entityId: body.changeEventId,
    metadata: {
      risk_bucket: assessment.risk_bucket ?? null,
      missing_required_evidence: missing,
    },
  });

  await auditLog(db, {
    orgId: change.org_id as string,
    actorId: checklistActorId,
    actorType: "USER",
    action: "approvals_assigned",
    entityType: "change",
    entityId: body.changeEventId,
    metadata: { inserted: approvalsInserted },
  });

  return NextResponse.json({
    ok: true,
    risk_bucket: assessment.risk_bucket,
    missing_required_evidence: missing,
    approvals_inserted: approvalsInserted,
  });
}
