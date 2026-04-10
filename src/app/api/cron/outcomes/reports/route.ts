import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import {
  buildCsvExportPayload,
  loadMonthlySummaryKpis,
  loadQuarterlySummaryKpis,
} from "@/lib/outcomes/generateReportPayload";
import { generateMonthlyExecutiveSummaryPdf } from "@/lib/reports/generatePdfReport";
import { generateQuarterlyBusinessReviewPptx } from "@/lib/reports/generateQuarterlyBusinessReviewPptx";
import {
  createSignedReportUrl,
  reportStoragePath,
  uploadReportObject,
} from "@/lib/reports/uploadGeneratedReport";
import { notifyReportReady } from "@/lib/reports/notifyReportReady";

function isMonthlyType(t: string): boolean {
  return t === "MONTHLY_PDF" || t === "MONTHLY_EXEC_SUMMARY";
}

function isQuarterlyType(t: string): boolean {
  return t === "QUARTERLY_PPTX" || t === "QUARTERLY_BUSINESS_REVIEW";
}

/**
 * POST /api/cron/outcomes/reports — async generated_reports: CSV + optional PDF/PPTX, storage, notify.
 */
export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  try {
    const admin = createAdminClient();
    const { data: pending, error } = await admin
      .from("generated_reports")
      .select(
        "id, org_id, report_type, period_start, period_end, requesting_user_id, status"
      )
      .in("status", ["PENDING", "QUEUED"])
      .order("created_at", { ascending: true })
      .limit(25);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let done = 0;
    for (const r of pending ?? []) {
      const row = r as {
        id: string;
        org_id: string;
        report_type: string;
        period_start: string;
        period_end: string;
        requesting_user_id: string | null;
        status: string;
      };
      await admin.from("generated_reports").update({ status: "PROCESSING" }).eq("id", row.id);
      try {
        const { csv, filename } = await buildCsvExportPayload(
          admin,
          row.org_id,
          row.period_start,
          row.period_end
        );
        const csvPath = reportStoragePath({
          orgId: row.org_id,
          reportType: row.report_type,
          reportId: row.id,
          ext: "csv",
        });
        const csvUp = await uploadReportObject(admin, {
          path: csvPath,
          body: Buffer.from(csv, "utf-8"),
          contentType: "text/csv",
        });
        if (csvUp.error) throw new Error(csvUp.error);

        let primaryPath = csvPath;
        const artifacts: Record<string, string> = { csv: csvPath };

        if (isMonthlyType(row.report_type)) {
          const kpis = await loadMonthlySummaryKpis(admin, row.org_id, row.period_start, row.period_end);
          const pdfBuf = await generateMonthlyExecutiveSummaryPdf(kpis);
          const pdfPath = reportStoragePath({
            orgId: row.org_id,
            reportType: row.report_type,
            reportId: `${row.id}-summary`,
            ext: "pdf",
          });
          const pdfUp = await uploadReportObject(admin, {
            path: pdfPath,
            body: pdfBuf,
            contentType: "application/pdf",
          });
          if (pdfUp.error) throw new Error(pdfUp.error);
          artifacts.pdf = pdfPath;
          primaryPath = pdfPath;
        }

        if (isQuarterlyType(row.report_type)) {
          const kpis = await loadQuarterlySummaryKpis(admin, row.org_id, row.period_start, row.period_end);
          const pdfBuf = await generateMonthlyExecutiveSummaryPdf(kpis);
          const pdfPath = reportStoragePath({
            orgId: row.org_id,
            reportType: row.report_type,
            reportId: `${row.id}-summary`,
            ext: "pdf",
          });
          const pdfUp = await uploadReportObject(admin, {
            path: pdfPath,
            body: pdfBuf,
            contentType: "application/pdf",
          });
          if (pdfUp.error) throw new Error(pdfUp.error);
          artifacts.pdf = pdfPath;

          const pptxBuf = await generateQuarterlyBusinessReviewPptx(kpis);
          const pptxPath = reportStoragePath({
            orgId: row.org_id,
            reportType: row.report_type,
            reportId: `${row.id}-qbr`,
            ext: "pptx",
          });
          const pptxUp = await uploadReportObject(admin, {
            path: pptxPath,
            body: pptxBuf,
            contentType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          });
          if (pptxUp.error) throw new Error(pptxUp.error);
          artifacts.pptx = pptxPath;
          primaryPath = pptxPath;
        }

        const signed = await createSignedReportUrl(admin, primaryPath, 604800);
        await admin
          .from("generated_reports")
          .update({
            status: "COMPLETED",
            completed_at: new Date().toISOString(),
            storage_url: signed.url,
            storage_path: primaryPath,
            error_json: null,
            result_json: {
              format: "MULTI",
              filename,
              csvFilename: filename,
              artifacts,
            } as unknown as Record<string, unknown>,
          })
          .eq("id", row.id);

        await notifyReportReady({
          admin,
          orgId: row.org_id,
          reportId: row.id,
          requestingUserId: row.requesting_user_id,
          ok: true,
        });
        done += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "report failed";
        await admin
          .from("generated_reports")
          .update({
            status: "FAILED",
            completed_at: new Date().toISOString(),
            error_json: { message: msg } as unknown as Record<string, unknown>,
          })
          .eq("id", row.id);
        await notifyReportReady({
          admin,
          orgId: row.org_id,
          reportId: row.id,
          requestingUserId: (r as { requesting_user_id?: string | null }).requesting_user_id ?? null,
          ok: false,
          errorMessage: msg,
        });
      }
    }

    return NextResponse.json({ ok: true, processed: done });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "reports job failed" },
      { status: 500 }
    );
  }
}
