import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getReadyStatus } from "@/services/risk/readyStatus";
import { fetchMitigationsForSignals } from "@/services/risk/mitigationsDb";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function mdEscape(s: string) {
  return s.replace(/[\r\n]+/g, " ").trim();
}

function safeLines(md: string) {
  return md.replace(/\t/g, "  ").split("\n");
}

async function buildApprovalPacketMarkdown({
  supabase,
  changeId,
  orgId,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  changeId: string;
  orgId: string;
}) {
  const { data: change, error: changeErr } = await scopeActiveChangeEvents(supabase.from("change_events").select(
      "id, org_id, title, change_type, status, domain, intake, systems_involved, revenue_impact_areas, submitted_at, due_at, sla_status, escalated_at, risk_explanation, last_notified_at"
    ))
    .eq("id", changeId)
    .maybeSingle();

  if (changeErr || !change)
    throw new Error(changeErr?.message ?? "Change not found");

  const ready = await getReadyStatus(supabase, { changeId });

  const { data: assessment } = await supabase
    .from("impact_assessments")
    .select("risk_bucket, risk_score_raw, status, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: signals } = await supabase
    .from("risk_signals")
    .select("signal_key, category, contribution")
    .eq("change_event_id", changeId)
    .order("contribution", { ascending: false })
    .limit(20);

  const topSignals = (signals ?? [])
    .filter((s: { contribution?: number }) => (s.contribution ?? 0) !== 0)
    .slice(0, 10)
    .map((s: { signal_key?: string; category?: string; contribution?: number }) => ({
      key: String(s.signal_key ?? ""),
      category: String(s.category ?? "UNKNOWN"),
      contribution: Number(s.contribution ?? 0),
    }));

  const { data: evidence } = await supabase
    .from("change_evidence")
    .select("kind, label, url, note, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false });

  const { data: approvals } = await supabase
    .from("approvals")
    .select("approval_area, decision, comment, decided_at, approver_user_id, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: true });

  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, status, title, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false });

  const { data: deliveries } = await supabase
    .from("notification_outbox")
    .select(
      "channel, template_key, status, attempt_count, last_error, created_at, sent_at, delivered_count"
    )
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(50);

  const signalKeys = topSignals.map((s) => s.key);
  const mitigations = await fetchMitigationsForSignals(supabase, {
    orgId,
    domain: (change as { domain?: string }).domain ?? "REVENUE",
    signalKeys,
  });

  const title = toStr((change as { title?: string }).title) || "Change";
  const intake = ((change as { intake?: unknown }).intake ?? {}) as Record<string, unknown>;
  const desc =
    typeof intake?.description === "string" ? intake.description : "";

  const md: string[] = [];
  md.push(`# Approval Packet`);
  md.push(``);
  md.push(`## Change`);
  md.push(`- **ID:** ${changeId}`);
  md.push(`- **Title:** ${mdEscape(title)}`);
  md.push(`- **Type:** ${toStr((change as { change_type?: string }).change_type)}`);
  md.push(`- **Status:** ${toStr((change as { status?: string }).status)}`);
  md.push(`- **Domain:** ${toStr((change as { domain?: string }).domain)}`);
  md.push(`- **Submitted:** ${toStr((change as { submitted_at?: string }).submitted_at)}`);
  md.push(`- **Due (SLA):** ${toStr((change as { due_at?: string }).due_at)}`);
  md.push(`- **SLA Status:** ${toStr((change as { sla_status?: string }).sla_status)}`);
  md.push(``);

  if (desc) {
    md.push(`## Description`);
    md.push(desc.trim());
    md.push(``);
  }

  const systems = Array.isArray((change as { systems_involved?: string[] }).systems_involved)
    ? (change as { systems_involved: string[] }).systems_involved
    : [];
  const impacts = Array.isArray((change as { revenue_impact_areas?: string[] }).revenue_impact_areas)
    ? (change as { revenue_impact_areas: string[] }).revenue_impact_areas
    : [];
  if (systems.length || impacts.length) {
    md.push(`## Scope`);
    if (systems.length) {
      md.push(`**Systems involved**`);
      md.push(systems.map((s) => `- ${s}`).join("\n"));
      md.push(``);
    }
    if (impacts.length) {
      md.push(`**Impact areas**`);
      md.push(impacts.map((i) => `- ${i}`).join("\n"));
      md.push(``);
    }
  }

  md.push(`## Risk`);
  md.push(
    `- **Score:** ${assessment?.risk_score_raw != null ? Math.round(Number(assessment.risk_score_raw)) : "(unknown)"}`
  );
  md.push(`- **Bucket:** ${assessment?.risk_bucket ?? "(unknown)"}`);
  md.push(`- **Assessment status:** ${assessment?.status ?? "(unknown)"}`);
  md.push(``);

  if (topSignals.length) {
    md.push(`### Top signal drivers`);
    md.push(
      topSignals
        .map(
          (s) =>
            `- **${s.key}** (${s.category}) — contribution ${s.contribution.toFixed(2)}`
        )
        .join("\n")
    );
    md.push(``);
  }

  md.push(`### Mitigations`);
  if (!mitigations.length) {
    md.push(`- (none found for detected signals)`);
  } else {
    mitigations.slice(0, 12).forEach((m) => {
      md.push(`- **[${m.severity}]** ${m.signalKey} — ${m.recommendation}`);
    });
  }
  md.push(``);

  md.push(`## Readiness`);
  md.push(`- **Ready:** ${ready.ready ? "YES" : "NO"}`);
  md.push(
    `- **Missing evidence:** ${ready.missingEvidence.length ? ready.missingEvidence.join(", ") : "(none)"}`
  );
  md.push(
    `- **Missing approvals:** ${ready.missingApprovalAreas.length ? ready.missingApprovalAreas.join(", ") : "(none)"}`
  );
  md.push(
    `- **Blocking incidents:** ${
      ready.blockingIncidents.length
        ? ready.blockingIncidents.map((i) => `${i.id} (${i.status ?? "unknown"})`).join(", ")
        : "(none)"
    }`
  );
  md.push(``);

  md.push(`## Evidence attached`);
  if (!evidence || evidence.length === 0) {
    md.push(`- (none)`);
  } else {
    evidence.forEach((e: { kind?: string; label?: string; url?: string | null; note?: string | null }) => {
      md.push(`- **${toStr(e.kind)}** — ${toStr(e.label)}`);
      if (e.url) md.push(`  - Link: ${toStr(e.url)}`);
      if (e.note) {
        const note = toStr(e.note).trim();
        md.push(`  - Notes: ${note.slice(0, 500)}${note.length > 500 ? "…" : ""}`);
      }
    });
  }
  md.push(``);

  md.push(`## Approvals`);
  if (!approvals || approvals.length === 0) {
    md.push(`- (none)`);
  } else {
    approvals.forEach(
      (a: {
        approval_area?: string;
        decision?: string;
        approver_user_id?: string;
        decided_at?: string | null;
        comment?: string | null;
      }) => {
        md.push(
          `- **${toStr(a.approval_area)}** — ${toStr(a.decision ?? "PENDING")} (approver: ${toStr(a.approver_user_id)}, decided_at: ${toStr(a.decided_at)})`
        );
        if (a.comment)
          md.push(`  - Comment: ${toStr(a.comment).slice(0, 500)}`);
      }
    );
  }
  md.push(``);

  md.push(`## Incidents`);
  if (!incidents || incidents.length === 0) {
    md.push(`- (none)`);
  } else {
    incidents.forEach(
      (i: { id?: string; title?: string; status?: string; created_at?: string }) => {
        md.push(
          `- **${toStr(i.title || i.id)}** — ${toStr(i.status)} (${toStr(i.created_at)})`
        );
      }
    );
  }
  md.push(``);

  md.push(`## Delivery status (recent)`);
  if (!deliveries || deliveries.length === 0) {
    md.push(`- (none)`);
  } else {
    deliveries.forEach(
      (o: {
        channel?: string;
        status?: string;
        attempt_count?: number;
        last_error?: string | null;
      }) => {
        md.push(
          `- **${toStr(o.channel)}** — ${toStr(o.status)} (attempts: ${toStr(o.attempt_count)}, last_error: ${toStr(o.last_error).slice(0, 120)})`
        );
      }
    );
  }
  md.push(``);

  return { md: md.join("\n"), changeTitle: title };
}

function renderPdfFromMarkdown(md: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const lines = safeLines(md);
  doc.font("Helvetica");
  doc.fontSize(12);

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    if (line.startsWith("# ")) {
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").fontSize(18).text(line.slice(2).trim());
      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(12);
      continue;
    }
    if (line.startsWith("## ")) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(14).text(line.slice(3).trim());
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(12);
      continue;
    }
    if (line.startsWith("### ")) {
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(12).text(line.slice(4).trim());
      doc.moveDown(0.15);
      doc.font("Helvetica").fontSize(12);
      continue;
    }

    if (line.trim() === "") {
      doc.moveDown(0.25);
      continue;
    }

    const isBullet = /^\s*-\s+/.test(line);
    if (isBullet) {
      doc.text(line.trim(), { indent: 12 });
    } else {
      doc.text(line);
    }
  }

  doc.end();
  return done;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "md";

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: changeOrgRow, error: orgErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("org_id"))
    .eq("id", changeId)
    .maybeSingle();

  if (orgErr || !changeOrgRow?.org_id) {
    return NextResponse.json({ error: "Change not found" }, { status: 404 });
  }

  const orgId = (changeOrgRow as { org_id: string }).org_id;

  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let packet;
  try {
    packet = await buildApprovalPacketMarkdown({ supabase, changeId, orgId });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to generate packet",
      },
      { status: 500 }
    );
  }

  if (format === "pdf") {
    const pdf = await renderPdfFromMarkdown(packet.md);

    const filenameBase = packet.changeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="approval-packet-${filenameBase || "change"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(packet.md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="approval-packet-${changeId}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
