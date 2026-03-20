/**
 * Phase 3 — Scheduling meeting canceled mapper (§13).
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "scheduling.meeting.canceled";
const MAPPER_VERSION = "1.0.0";

export class MeetingCanceledMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    return (
      (ctx.provider === "chilipiper" || ctx.provider === "calendly" || ctx.provider === "oncehub" || ctx.provider === "scheduling") &&
      (ctx.eventType?.toLowerCase().includes("cancel") ||
        ctx.eventType === "invitee.canceled" ||
        ctx.eventType === "routing_form_submission.canceled")
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p = ctx.payload as Record<string, unknown>;
    const meetingId = String(ctx.externalObjectId ?? p.id ?? p.event_id ?? p.booking_id ?? "");

    const entityCandidates = [entityCandidate(ctx.provider, "meeting", meetingId, "meeting", 1)];

    return baseMapperResult("meeting_canceled", ctx, {
      dimensions: {},
      measures: {},
      references: {},
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
