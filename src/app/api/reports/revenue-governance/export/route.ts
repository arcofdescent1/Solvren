/**
 * CFO Feature — Revenue Governance Audit Package Export
 * GET /api/reports/revenue-governance/export?format=json|csv|pdf&orgId=...
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import PDFDocument from "pdfkit";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10) || 90, 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [
    { data: changes },
    { data: approvals },
    { data: evidence },
    { data: riskEvents },
    { data: auditLog },
  ] = await Promise.all([
    supabase
      .from("change_events")
      .select("id, title, change_type, domain, status, submitted_at, revenue_at_risk, created_at")
      .eq("org_id", orgId)
      .gte("submitted_at", since.toISOString()),
    supabase
      .from("approvals")
      .select("change_event_id, approval_area, decision, decided_at, approver_user_id")
      .eq("org_id", orgId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("change_evidence_items")
      .select("change_event_id, kind, label, status, provided_at")
      .eq("org_id", orgId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("risk_events")
      .select("id, provider, object, risk_type, impact_amount, approved_at, timestamp")
      .eq("org_id", orgId)
      .gte("timestamp", since.toISOString()),
    supabase
      .from("audit_log")
      .select("action, entity_type, entity_id, metadata, created_at")
      .eq("org_id", orgId)
      .gte("created_at", since.toISOString()),
  ]);

  const package_ = {
    generatedAt: new Date().toISOString(),
    periodDays: days,
    change_requests: changes ?? [],
    approvals: approvals ?? [],
    evidence_items: evidence ?? [],
    risk_events: riskEvents ?? [],
    audit_log: auditLog ?? [],
  };

  if (format === "csv") {
    const lines: string[] = [
      "Revenue Governance Compliance Report",
      `Generated,${package_.generatedAt}`,
      `Period,Last ${days} days`,
      "",
      "change_requests",
      "id,title,change_type,domain,status,submitted_at,revenue_at_risk",
      ...(package_.change_requests as Array<Record<string, unknown>>).map((r) =>
        [r.id, r.title, r.change_type, r.domain, r.status, r.submitted_at, r.revenue_at_risk].join(",")
      ),
      "",
      "approvals",
      "change_event_id,approval_area,decision,decided_at",
      ...(package_.approvals as Array<Record<string, unknown>>).map((r) =>
        [r.change_event_id, r.approval_area, r.decision, r.decided_at].join(",")
      ),
      "",
      "evidence_items",
      "change_event_id,kind,label,status",
      ...(package_.evidence_items as Array<Record<string, unknown>>).map((r) =>
        [r.change_event_id, r.kind, r.label, r.status].join(",")
      ),
    ];
    const csv = lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="revenue-governance-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (format === "json") {
    return new NextResponse(JSON.stringify(package_, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="revenue-governance-audit-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }

  if (format === "pdf") {
    const changes = (package_.change_requests ?? []) as Array<{
      id?: string;
      title?: string;
      change_type?: string;
      domain?: string;
      status?: string;
      submitted_at?: string;
      revenue_at_risk?: number;
    }>;
    const approvedCount = changes.filter((c) => c.status === "APPROVED").length;
    const totalCount = changes.length;
    const complianceRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 1000) / 10 : 100;
    const riskExposure = (package_.risk_events as Array<{ impact_amount?: number; approved_at?: string | null }> ?? [])
      .filter((r) => !r.approved_at)
      .reduce((sum, r) => sum + (Number(r.impact_amount) || 0), 0);

    function fmt(n: number) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
    }

    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 48, bottom: 48, left: 48, right: 48 },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    const pdfDone = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.font("Helvetica");
    doc.fontSize(18).font("Helvetica-Bold").text("Revenue Governance Compliance Report", { align: "center" });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor("#666666").text(`Generated: ${package_.generatedAt} · Period: Last ${days} days`, { align: "center" });
    doc.moveDown(1);
    doc.fillColor("#000000");

    doc.fontSize(12).font("Helvetica-Bold").text("Key Metrics");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Revenue Impacting Changes: ${totalCount}`);
    doc.text(`Approved Changes: ${approvedCount}`);
    doc.text(`Unapproved Changes: ${totalCount - approvedCount}`);
    doc.text(`Compliance Rate: ${complianceRate}%`);
    doc.text(`Unapproved Risk Exposure: ${fmt(riskExposure)}`);
    doc.moveDown(1);

    doc.font("Helvetica-Bold").text("Governance Exceptions (Sample)");
    doc.moveDown(0.3);
    const exceptions = changes.filter((c) => c.status !== "APPROVED").slice(0, 15);
    if (exceptions.length === 0) {
      doc.font("Helvetica").text("No exceptions in the period.");
    } else {
      const x0 = 50;
      const colStarts = [x0, 200, 320, 400];
      let y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9);
      doc.text("Change", colStarts[0], y);
      doc.text("System", colStarts[1], y);
      doc.text("Impact", colStarts[2], y);
      doc.text("Status", colStarts[3], y);
      doc.moveTo(50, y + 14).lineTo(550, y + 14).stroke();
      y += 18;
      doc.font("Helvetica").fontSize(9);
      for (const ex of exceptions) {
        const title = String(ex.title ?? ex.change_type ?? ex.id ?? "").slice(0, 28);
        const sys = String(ex.domain ?? "—").slice(0, 18);
        const impact = fmt(Number(ex.revenue_at_risk) || 0);
        const status = String(ex.status ?? "—").slice(0, 12);
        doc.text(title, colStarts[0], y);
        doc.text(sys, colStarts[1], y);
        doc.text(impact, colStarts[2], y);
        doc.text(status, colStarts[3], y);
        y += 16;
        if (y > 700) {
          doc.addPage();
          y = 48;
        }
      }
    }
    doc.moveDown(1);

    doc.font("Helvetica-Bold").text("Audit Package Contents");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9);
    doc.text(`Change requests: ${(package_.change_requests ?? []).length} records`);
    doc.text(`Approvals: ${(package_.approvals ?? []).length} records`);
    doc.text(`Evidence items: ${(package_.evidence_items ?? []).length} records`);
    doc.text(`Risk events: ${(package_.risk_events ?? []).length} records`);
    doc.text(`Audit log: ${(package_.audit_log ?? []).length} records`);
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("#666666").text("Full detail available in JSON/CSV export.", { link: null });
    doc.fillColor("#000000");

    doc.end();
    const pdf = await pdfDone;
    const filename = `revenue-governance-audit-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format. Use json, csv, or pdf." }, { status: 400 });
}
