/**
 * Phase 3 — Scheduling meeting booked mapper (§13). Chili Piper, Calendly, etc.
 */
import type { IMapper } from "../../domain/mapper.interface";
import type { MapperContext } from "../../domain/mapper-context";
import { baseMapperResult, entityCandidate } from "../base/base-mapper";

const MAPPER_KEY = "scheduling.meeting.booked";
const MAPPER_VERSION = "1.0.0";

export class MeetingBookedMapper implements IMapper {
  readonly mapperKey = MAPPER_KEY;
  readonly mapperVersion = MAPPER_VERSION;

  canMap(ctx: MapperContext): boolean {
    return (
      (ctx.provider === "chilipiper" || ctx.provider === "calendly" || ctx.provider === "oncehub" || ctx.provider === "scheduling") &&
      (ctx.eventType?.toLowerCase().includes("booked") ||
        ctx.eventType?.toLowerCase().includes("scheduled") ||
        ctx.eventType === "invitee.created" ||
        ctx.externalObjectType === "meeting" ||
        ctx.externalObjectType === "booking")
    );
  }

  async map(ctx: MapperContext): Promise<import("../../domain/types").MapperResult | null> {
    const p = ctx.payload as Record<string, unknown>;
    const meetingId = String(ctx.externalObjectId ?? p.id ?? p.event_id ?? p.booking_id ?? "");
    const outcome = (p.outcome ?? p.status ?? p.state) as string | undefined;
    const invEmail = (p.invitee_email ?? p.email ?? (p.invitee as Record<string, unknown>)?.email) as string | undefined;
    const oppId = (p.opportunity_id ?? p.deal_id ?? (p.booking as Record<string, unknown>)?.opportunity_id) as string | undefined;

    const entityCandidates = [entityCandidate(ctx.provider, "meeting", meetingId, "meeting", 1)];
    if (oppId) entityCandidates.push(entityCandidate(ctx.provider, "opportunity", String(oppId), "opportunity", 0.9));

    return baseMapperResult("meeting_booked", ctx, {
      dimensions: { outcome: outcome ?? "booked" },
      measures: {},
      references: { opportunity_id: oppId ?? null, invitee_email: invEmail ?? null },
      entityCandidates,
      lineage: { mapperKey: MAPPER_KEY, mapperVersion: MAPPER_VERSION },
    });
  }
}
