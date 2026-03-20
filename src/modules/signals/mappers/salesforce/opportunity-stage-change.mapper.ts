/**
 * Phase 3 — Salesforce opportunity stage change mapper (§13).
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "salesforce.opportunity.stage_change";
const MAPPER_VERSION = "1.0.0";

export class SalesforceOpportunityStageChangeMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    return (
      ctx.provider === "salesforce" &&
      (ctx.eventType?.toLowerCase().includes("opportunity") ||
        ctx.externalObjectType === "Opportunity" ||
        ctx.externalObjectType === "opportunity")
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p: Record<string, unknown> = ctx.payload;
    const oppId = String(ctx.externalObjectId ?? p["Id"] ?? p["id"] ?? "");
    const stage = (p["StageName"] ?? p["Stage"] ?? p["Stage__c"]) as string | undefined;
    const amount = Number(p["Amount"] ?? p["Total_Value__c"] ?? 0);
    const accountId = ((p["AccountId"] ?? (p["Account"] as Record<string, unknown>)?.["Id"]) ?? undefined) as string | undefined;

    const entityCandidates = [entityCandidate("salesforce", "opportunity", oppId, "opportunity", 1)];
    if (accountId) entityCandidates.push(entityCandidate("salesforce", "account", String(accountId), "company", 0.9));

    return baseMapperResult("opportunity_stage_changed", ctx, {
      dimensions: { stage: stage ?? "unknown" },
      measures: { amount },
      references: {},
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
