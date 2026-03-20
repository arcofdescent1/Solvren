/**
 * Phase 3 — Salesforce lead status change mapper (§13).
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "salesforce.lead.status_change";
const MAPPER_VERSION = "1.0.0";

export class SalesforceLeadStatusChangeMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    return (
      ctx.provider === "salesforce" &&
      (ctx.eventType?.toLowerCase().includes("lead") ||
        ctx.externalObjectType === "Lead" ||
        ctx.externalObjectType === "lead")
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p = ctx.payload as Record<string, unknown>;
    const leadId = String(ctx.externalObjectId ?? p.Id ?? p.id ?? "");
    const status = (p.Status ?? p.LeadStatus) as string | undefined;
    const accountId = (p.AccountId ?? p.Company) as string | undefined;

    const entityCandidates = [entityCandidate("salesforce", "lead", leadId, "person", 1)];
    if (accountId) entityCandidates.push(entityCandidate("salesforce", "account", String(accountId), "company", 0.9));

    return baseMapperResult("lead_status_changed", ctx, {
      dimensions: { status: status ?? "unknown" },
      measures: {},
      references: {},
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
