import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Decimal from "decimal.js";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import type { PortfolioRow } from "@/lib/finance";

export type ReportPacket = {
  organization: string; periodStart: string; periodEnd: string;
  generatedAt: string; formulaVersion: string; confidence: string;
  portfolio: PortfolioRow[];
  reconciliation: Array<Record<string, unknown>>;
  unmapped: Array<Record<string, unknown>>;
  contracts: Array<Record<string, unknown>>;
  mappings: Array<Record<string, unknown>>;
  providerCostBuckets: Array<Record<string, unknown>>;
  rateCards: Array<Record<string, unknown>>;
  issues: Array<Record<string, unknown>>;
  exceptions: Array<{ kind: string; subject: string; status: string; detail: string }>;
};

const definitions = [
  "Contract revenue: effective monthly or annual base fee allocated daily, after contract discount, plus observed completed-outcome overages.",
  "Known direct cost: measured model cost or effective rate-card estimate, plus supplied tool, human-review, and other direct costs.",
  "Contribution: management-estimate contract revenue minus known direct cost; not GAAP revenue recognition.",
  "Unassigned supplier spend: positive supplier-reported cost less attributed direct-billed usage. It is not allocated to customers.",
  "Verified: full supplier period, mapped and priced direct usage, scope IDs, fresh connector evidence, and variance within 5% or $0.01.",
  "Source exclusions: unknown model prices, unmapped events, gateway/cloud billing outside direct supplier reconciliation, and costs not supplied by the customer.",
];

function cell(value: unknown) {
  const string = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(string) ? `'${string}` : string;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function reportCsv(packet: ReportPacket) {
  const lines = [["section", "id", "name", "metric", "value", "status", "detail"].map(cell).join(",")];
  const add = (section: string, id: unknown, name: unknown, metric: unknown,
    value: unknown, status: unknown, detail: unknown) =>
    lines.push([section, id, name, metric, value, status, detail].map(cell).join(","));
  add("report", "", packet.organization, "period_start", packet.periodStart, packet.confidence, packet.formulaVersion);
  add("report", "", packet.organization, "period_end_exclusive", packet.periodEnd, packet.confidence, packet.generatedAt);
  for (const line of definitions) add("definition", "", "", "formula", "", "", line);
  for (const row of packet.portfolio) {
    const margin = new Decimal(row.revenue_usd).minus(row.known_cost_usd);
    add("customer", row.customer_external_id, row.customer_name, "contract_revenue_usd", row.revenue_usd,
      row.unknown_cost_events ? "partial" : "observed", `target margin ${row.target_margin_pct}%`);
    add("customer", row.customer_external_id, row.customer_name, "known_direct_cost_usd", row.known_cost_usd,
      row.unknown_cost_events ? "partial" : "observed", `${row.unknown_cost_events} unpriced events`);
    add("customer", row.customer_external_id, row.customer_name, "contribution_upper_bound_usd", margin.toFixed(2),
      row.unknown_cost_events ? "partial" : "observed", `${row.completed_outcomes} completed outcomes`);
  }
  for (const row of packet.reconciliation) {
    const id = row.provider;
    add("supplier", id, row.source, "reported_usd", row.reported_usd, row.status,
      `${row.covered_days}/${row.total_days} days`);
    add("supplier", id, row.source, "attributed_usd", row.attributed_usd, row.status,
      `${row.unmapped_events} unmapped; ${row.unpriced_events} unpriced`);
    add("supplier", id, row.source, "variance_usd", row.variance_usd, row.status,
      "Reported less attributed; no automatic allocation");
  }
  for (const row of packet.unmapped) add("excluded", row.source_customer_id, row.source,
    "unmapped_events", row.event_count, "partial", `${row.known_cost_usd} measured USD`);
  for (const row of packet.contracts) add("contract_version", row.customer_id, row.version,
    "base_fee_usd", row.base_fee_usd, "effective",
    `${row.effective_from} to ${row.effective_to ?? "current"}; ${row.billing_period}; ${row.discount_pct}% discount`);
  for (const row of packet.mappings) add("customer_mapping", row.source_customer_id, row.source,
    "customer_id", row.customer_id, "active", "Source identity mapped at freeze time");
  for (const row of packet.rateCards) add("model_rate", row.provider, row.model,
    "input_per_million_usd", row.input_per_million_usd, "effective", row.effective_from);
  for (const row of packet.rateCards) add("model_rate", row.provider, row.model,
    "output_per_million_usd", row.output_per_million_usd, "effective", row.effective_from);
  for (const row of packet.providerCostBuckets) add("supplier_bucket", row.scope_id, row.provider,
    row.line_item, row.amount_usd, "captured", row.day);
  for (const issue of packet.exceptions) add("exception", issue.subject, issue.kind,
    "status", issue.status, issue.status, issue.detail);
  for (const issue of packet.issues) add("managed_issue", issue.id, issue.kind,
    "status", issue.status, issue.status,
    `${issue.first_seen_at} to ${issue.last_seen_at}; ${issue.exposure_usd} USD known exposure; assignee ${issue.assignee_user_id ?? "unassigned"}`);
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function reportPdf(packet: ReportPacket) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const bytes = await readFile(join(process.cwd(), "src", "assets", "noto-sans-latin-400-normal.woff"));
  const font = await pdf.embedFont(bytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const ink = rgb(0.08, 0.15, 0.18);
  const muted = rgb(0.36, 0.43, 0.45);
  const teal = rgb(0.03, 0.45, 0.42);
  let page = pdf.addPage([612, 792]); let y = 747;
  const safe = (value: string) => Array.from(value).map((character) =>
    supported.has(character.codePointAt(0)!) ? character : `[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`).join("");
  function nextPage() { page = pdf.addPage([612, 792]); y = 747; }
  function line(value: string, size = 9, color = ink, indent = 0) {
    const max = 520 - indent;
    const words = safe(value).split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > max) {
        if (y < 45) nextPage();
        page.drawText(current, { x: 46 + indent, y, font, size, color }); y -= size + 5;
        current = word;
      } else current = candidate;
    }
    if (current) { if (y < 45) nextPage(); page.drawText(current,
      { x: 46 + indent, y, font, size, color }); y -= size + 5; }
  }
  function heading(value: string) { y -= 11; if (y < 75) nextPage(); line(value, 13, teal); y -= 4; }
  line("SOLVREN / CONTRACT MARGIN CONTROL", 11, teal);
  y -= 12;
  line(`${packet.organization}  |  ${packet.periodStart} to ${packet.periodEnd} (end exclusive)`, 16);
  line(`Frozen ${packet.generatedAt}  |  ${packet.confidence}  |  ${packet.formulaVersion}`, 9, muted);
  heading("Metric definitions and assumptions");
  for (const definition of definitions) { line(`• ${definition}`, 9, ink, 8); y -= 3; }
  heading("Supplier reconciliation");
  for (const row of packet.reconciliation) line(`${row.provider}: ${row.status} / ${row.source}; reported $${row.reported_usd ?? "unavailable"}, attributed $${row.attributed_usd}, variance $${row.variance_usd ?? "unavailable"}; ${row.covered_days}/${row.total_days} days; ${row.unmapped_events} unmapped, ${row.unpriced_events} unpriced.`);
  heading("Customer contract economics");
  for (const row of packet.portfolio) {
    const margin = new Decimal(row.revenue_usd).minus(row.known_cost_usd);
    line(`${row.customer_name} (${row.customer_external_id}): revenue $${row.revenue_usd}; known cost $${row.known_cost_usd}; contribution upper bound $${margin.toFixed(2)}; target ${row.target_margin_pct}%; ${row.unknown_cost_events} unpriced events.`);
  }
  heading("Included contract versions");
  for (const row of packet.contracts) line(`Customer ${row.customer_id}; version ${row.version}; ${row.effective_from}–${row.effective_to ?? "current"}; ${row.billing_period}; base $${row.base_fee_usd}; ${row.included_outcomes} included; overage $${row.overage_usd}; discount ${row.discount_pct}%.`);
  heading("Customer identity mapping");
  line(`${packet.mappings.length} source identities mapped at freeze time; full mapping evidence is in the companion CSV.`);
  heading("Excluded and unresolved evidence");
  if (!packet.unmapped.length && !packet.exceptions.length) line("No unmapped IDs or detected margin/reconciliation exceptions in this period.");
  for (const row of packet.unmapped) line(`${row.source}: ${row.source_customer_id}; ${row.event_count} unmapped events; $${row.known_cost_usd} measured cost excluded from customer totals.`);
  for (const issue of packet.exceptions) line(`${issue.kind}: ${issue.subject}; ${issue.status}; ${issue.detail}`);
  heading("Managed issue status at freeze time");
  if (!packet.issues.length) line("No managed issues were recorded for this reporting period.");
  for (const issue of packet.issues) line(`${issue.kind}: ${issue.status}; known exposure $${issue.exposure_usd}; assignee ${issue.assignee_user_id ?? "unassigned"}; last observed ${issue.last_seen_at}.`);
  const pages = pdf.getPages();
  pages.forEach((item, index) => item.drawText(`${index + 1} / ${pages.length}`, {
    x: 520, y: 22, font, size: 8, color: muted,
  }));
  return pdf.save();
}
