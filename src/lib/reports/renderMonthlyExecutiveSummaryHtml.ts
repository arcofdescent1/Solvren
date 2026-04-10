export type MonthlySummaryKpis = {
  orgName: string;
  periodLabel: string;
  revenueProtected: number;
  incidentsPrevented: number;
  approvalHoursSaved: number;
  readinessPoints: number;
  topStories: Array<{ headline: string; outcomeType: string; value: number }>;
};

export function renderMonthlyExecutiveSummaryHtml(k: MonthlySummaryKpis): string {
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const stories = k.topStories
    .slice(0, 5)
    .map(
      (s) =>
        `<li><strong>${escapeHtml(s.headline)}</strong> — ${escapeHtml(s.outcomeType)} (${money(s.value)})</li>`
    )
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Executive summary</title>
<style>
body{font-family:system-ui,sans-serif;color:#111;padding:24px;max-width:720px;}
h1{font-size:22px;} .card{border:1px solid #ddd;border-radius:8px;padding:12px;margin:12px 0;}
.muted{color:#555;font-size:13px;}
</style></head>
<body>
<h1>${escapeHtml(k.orgName)}</h1>
<p class="muted">Monthly outcomes — ${escapeHtml(k.periodLabel)}</p>
<div class="card"><strong>Revenue protected (est.)</strong><br/>${money(k.revenueProtected)}</div>
<div class="card"><strong>Incidents prevented</strong><br/>${k.incidentsPrevented}</div>
<div class="card"><strong>Approval hours saved</strong><br/>${Math.round(k.approvalHoursSaved)}</div>
<div class="card"><strong>Readiness points (avg.)</strong><br/>${k.readinessPoints.toFixed(1)}</div>
<h2>Top value stories</h2>
<ul>${stories || "<li>No finalized stories in period.</li>"}</ul>
<p class="muted">Figures reflect finalized value stories and org rollup settings.</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
