/**
 * Phase 3 — HubSpot deal stage change mapper (§13).
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "hubspot.deal.stage_change";
const MAPPER_VERSION = "1.0.0";

export class HubSpotDealStageChangeMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    if (ctx.provider !== "hubspot") return false;
    return (
      ctx.eventType === "deal.propertyChange" ||
      ctx.eventType === "deal.creation" ||
      (ctx.externalObjectType === "deal" && !!ctx.payload)
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p = ctx.payload as Record<string, unknown>;
    const props = (p.properties ?? p) as Record<string, unknown>;
    const dealId = String(ctx.externalObjectId ?? p.objectId ?? props.dealId ?? "");
    const stage = (props.dealstage ?? props.stage ?? props.hs_deal_stage) as string | undefined;
    const prevStage = (p.changeSource?.propertyMeta?.previousValue ?? (p as Record<string, unknown>).previousValue) as string | undefined;
    const amount = Number(props.amount ?? props.hs_deal_amount ?? 0);
    const companyId = (props.associatedcompanyid ?? props.hs_object_id) as string | undefined;

    const entityCandidates = [];
    entityCandidates.push(entityCandidate("hubspot", "deal", dealId, "opportunity", 1));
    if (companyId) entityCandidates.push(entityCandidate("hubspot", "company", String(companyId), "company", 0.9));

    return baseMapperResult("deal_stage_changed", ctx, {
      dimensions: {
        stage: stage ?? "unknown",
        previous_stage: prevStage ?? null,
      },
      measures: { amount },
      references: {},
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
