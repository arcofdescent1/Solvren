import PptxGenJS from "pptxgenjs";
import type { MonthlySummaryKpis } from "@/lib/reports/renderMonthlyExecutiveSummaryHtml";

export async function generateQuarterlyBusinessReviewPptx(k: MonthlySummaryKpis): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Solvren";

  const title = pptx.addSlide();
  title.addText("Quarterly business review", { x: 0.5, y: 1.2, fontSize: 28, bold: true });
  title.addText(k.orgName, { x: 0.5, y: 2, fontSize: 18 });
  title.addText(k.periodLabel, { x: 0.5, y: 2.6, fontSize: 14, color: "666666" });

  const kpi = pptx.addSlide();
  kpi.addText("KPI snapshot", { x: 0.5, y: 0.4, fontSize: 22, bold: true });
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const lines = [
    `Revenue protected (est.): ${money(k.revenueProtected)}`,
    `Incidents prevented: ${k.incidentsPrevented}`,
    `Approval hours saved: ${Math.round(k.approvalHoursSaved)}`,
    `Readiness points (avg.): ${k.readinessPoints.toFixed(1)}`,
  ];
  kpi.addText(lines.join("\n"), { x: 0.5, y: 1.2, fontSize: 16, valign: "top" });

  const storiesSlide = pptx.addSlide();
  storiesSlide.addText("Top value stories", { x: 0.5, y: 0.4, fontSize: 22, bold: true });
  const storyLines = k.topStories.slice(0, 6).map((s) => `• ${s.headline} (${s.outcomeType})`);
  storiesSlide.addText(storyLines.join("\n") || "No stories in period.", {
    x: 0.5,
    y: 1.1,
    fontSize: 14,
    valign: "top",
  });

  const arr = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return Buffer.from(arr);
}
