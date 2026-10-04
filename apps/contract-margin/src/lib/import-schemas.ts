import { parse } from "csv-parse/sync";
import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const isoTime = z.iso.datetime({ offset: true });
const day = z.iso.date();
const decimal = z.string().trim().regex(/^\d+(\.\d{1,8})?$/);
const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/);
const percent = z.string().trim().regex(/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/);
const whole = z.union([z.int().nonnegative(), z.string().trim().regex(/^\d+$/).transform(Number)]).pipe(z.int().nonnegative());
const optionalWhole = z.union([whole, z.literal("").transform(() => 0)]).optional().default(0);
const optionalDecimal = z.union([decimal, z.literal("").transform(() => undefined)]).optional();
const optionalDay = z.union([day, z.literal("").transform(() => undefined)]).optional();

const eventBase = {
  eventId: id,
  customerId: id,
  workflowId: id,
  runId: id,
  occurredAt: isoTime,
};

export const usageRow = z.strictObject({
  ...eventBase,
  provider: z.enum(["openai", "anthropic"]),
  billingRoute: z.enum(["openai_direct", "anthropic_direct", "gateway_or_cloud", "other"]),
  model: id,
  providerScopeId: z.union([id, z.literal("").transform(() => undefined)]).optional(),
  inputTokens: whole,
  outputTokens: whole,
  cacheReadTokens: optionalWhole,
  cacheWriteTokens: optionalWhole,
  reasoningOutputTokens: optionalWhole,
  reportedCostUsd: optionalDecimal,
  status: z.enum(["succeeded", "failed"]),
}).superRefine((value, context) => {
  if (value.billingRoute === "openai_direct" && value.provider !== "openai")
    context.addIssue({ code: "custom", path: ["billingRoute"], message: "Billing route disagrees with provider" });
  if (value.billingRoute === "anthropic_direct" && value.provider !== "anthropic")
    context.addIssue({ code: "custom", path: ["billingRoute"], message: "Billing route disagrees with provider" });
});

export const outcomeRow = z.strictObject({
  ...eventBase,
  status: z.enum(["completed", "failed", "cancelled"]),
});

export const directCostRow = z.strictObject({
  ...eventBase,
  category: z.enum(["tool", "human_review", "other"]),
  costUsd: decimal,
});

export const contractRow = z.strictObject({
  customerId: id,
  customerName: id,
  effectiveFrom: day,
  billingPeriod: z.enum(["monthly", "annual"]),
  baseFeeUsd: money,
  includedOutcomes: whole,
  overageUsd: money,
  discountPct: percent,
  targetMarginPct: z.union([percent, z.literal("").transform(() => undefined)]).optional(),
  renewalOn: optionalDay,
}).superRefine((value, context) => {
  if (Number(value.discountPct) > 100 || Number(value.targetMarginPct ?? 0) > 100)
    context.addIssue({ code: "custom", message: "Percent must be between 0 and 100" });
});

export const statementRow = z.strictObject({
  provider: z.enum(["openai", "anthropic"]),
  periodStart: day,
  periodEnd: day,
  totalUsd: money,
}).refine((value) => value.periodEnd > value.periodStart, "Statement end must be after start");

export type ImportKind = "usage" | "outcomes" | "direct_costs" | "contracts" | "statements";

export function validateRows(kind: ImportKind, values: unknown[]) {
  const schema = kind === "usage" ? usageRow : kind === "outcomes" ? outcomeRow
    : kind === "direct_costs" ? directCostRow : kind === "contracts" ? contractRow : statementRow;
  const accepted: Record<string, unknown>[] = [];
  const rejected: Array<{ row_number: number; reason: string }> = [];
  values.forEach((value, index) => {
    const result = schema.safeParse(value);
    if (result.success) accepted.push(result.data);
    else rejected.push({ row_number: index + 2,
      reason: result.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`).join("; ").slice(0, 500) });
  });
  return { accepted, rejected };
}

export function parseImportCsv(csv: string, kind: ImportKind) {
  if (new TextEncoder().encode(csv).length > 4_000_000) throw new Error("File exceeds the 4 MB import limit.");
  let headers: string[] = [];
  const values = parse(csv, {
    bom: true,
    columns: (first: string[]) => {
      headers = first.map((header) => header.trim());
      if (new Set(headers).size !== headers.length) throw new Error("Duplicate CSV column names are not allowed.");
      if (headers.some((header) => /prompt|response|inputtext|outputtext|message|document|card/i.test(header)))
        throw new Error("Content and payment-card fields are not accepted. Remove them before importing.");
      return headers;
    },
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as Record<string, string>[];
  if (values.length < 1 || values.length > 10_000) throw new Error("Import 1 to 10,000 data rows per file.");
  const result = validateRows(kind, values);
  return { ...result, totalRows: values.length };
}
