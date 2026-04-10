import PDFDocument from "pdfkit";
import type { MonthlySummaryKpis } from "@/lib/reports/renderMonthlyExecutiveSummaryHtml";

export async function generateMonthlyExecutiveSummaryPdf(k: MonthlySummaryKpis): Promise<Buffer> {
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50 });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text(k.orgName, { underline: false });
    doc.moveDown(0.25);
    doc.fontSize(11).fillColor("#555").text(`Monthly outcomes — ${k.periodLabel}`);
    doc.moveDown();
    doc.fillColor("#000").fontSize(12).text(`Revenue protected (est.): ${money(k.revenueProtected)}`);
    doc.text(`Incidents prevented: ${k.incidentsPrevented}`);
    doc.text(`Approval hours saved: ${Math.round(k.approvalHoursSaved)}`);
    doc.text(`Readiness points (avg.): ${k.readinessPoints.toFixed(1)}`);
    doc.moveDown();
    doc.fontSize(14).text("Top value stories");
    doc.fontSize(10);
    for (const s of k.topStories.slice(0, 5)) {
      doc.moveDown(0.35);
      doc.text(`• ${s.headline}`, { continued: false });
      doc.fillColor("#444").text(`  ${s.outcomeType} — ${money(s.value)}`, { indent: 10 });
      doc.fillColor("#000");
    }
    doc.moveDown();
    doc.fontSize(9).fillColor("#666").text("Figures reflect finalized value stories and org rollup settings.");

    doc.end();
  });
}
