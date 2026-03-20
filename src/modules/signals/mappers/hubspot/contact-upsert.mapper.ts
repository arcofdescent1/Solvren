/**
 * Phase 3 — HubSpot contact create/update mapper (§13).
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "hubspot.contact.upsert";
const MAPPER_VERSION = "1.0.0";

export class HubSpotContactUpsertMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    if (ctx.provider !== "hubspot") return false;
    return (
      ctx.eventType === "contact.creation" ||
      ctx.eventType === "contact.propertyChange" ||
      ctx.eventType === "contact.deletion" ||
      ctx.externalObjectType === "contact"
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p = ctx.payload as Record<string, unknown>;
    const props = (p.properties ?? p) as Record<string, unknown>;
    const contactId = String(ctx.externalObjectId ?? p.objectId ?? props.hs_object_id ?? "");

    const isDeletion = ctx.eventType === "contact.deletion";
    const signalKey = isDeletion ? "contact_deleted" : ctx.eventType === "contact.creation" ? "contact_created" : "contact_updated";

    const entityCandidates = [entityCandidate("hubspot", "contact", contactId, "person", 1)];

    return baseMapperResult(signalKey, ctx, {
      dimensions: {},
      measures: {},
      references: {},
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
