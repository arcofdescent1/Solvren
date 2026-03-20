/**
 * Phase 3 — Internal change approval mapper (§13).
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "internal.change.approved";
const MAPPER_VERSION = "1.0.0";

export class InternalChangeApprovedMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    return (
      ctx.provider === "internal" &&
      ctx.sourceChannel === "internal" &&
      (ctx.eventType === "change_approved" || ctx.eventType === "change.approved" || ctx.eventType === "approval_decided")
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p = ctx.payload as Record<string, unknown>;
    const changeId = String(ctx.externalObjectId ?? p.changeId ?? p.change_id ?? p.id ?? "");
    const decision = (p.decision ?? p.status ?? "approved") as string;

    const signalKey = decision === "rejected" ? "change_rejected" : "change_approved";
    const entityCandidates = [entityCandidate("internal", "change", changeId, "change", 1)];

    return baseMapperResult(signalKey, ctx, {
      dimensions: { status: decision },
      measures: {},
      references: { change_id: changeId },
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
