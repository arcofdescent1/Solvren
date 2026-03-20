/**
 * Phase 3 — Mapper registry (§11).
 */
import type { IMapper } from "../domain/mapper.interface";
import type { MapperContext } from "../domain/mapper-context";
import { StripeInvoicePaymentFailedMapper } from "./stripe/invoice-payment-failed.mapper";
import { StripeSubscriptionCanceledMapper } from "./stripe/subscription-canceled.mapper";
import { HubSpotContactUpsertMapper } from "./hubspot/contact-upsert.mapper";
import { HubSpotDealStageChangeMapper } from "./hubspot/deal-stage-change.mapper";
import { SalesforceLeadStatusChangeMapper } from "./salesforce/lead-status-change.mapper";
import { SalesforceOpportunityStageChangeMapper } from "./salesforce/opportunity-stage-change.mapper";
import { MeetingBookedMapper } from "./scheduling/meeting-booked.mapper";
import { MeetingCanceledMapper } from "./scheduling/meeting-canceled.mapper";
import { InternalChangeApprovedMapper } from "./internal/change-approved.mapper";

const MAPPERS: IMapper[] = [
  new StripeInvoicePaymentFailedMapper(),
  new StripeSubscriptionCanceledMapper(),
  new HubSpotContactUpsertMapper(),
  new HubSpotDealStageChangeMapper(),
  new SalesforceLeadStatusChangeMapper(),
  new SalesforceOpportunityStageChangeMapper(),
  new MeetingBookedMapper(),
  new MeetingCanceledMapper(),
  new InternalChangeApprovedMapper(),
];

export function resolveMapper(ctx: MapperContext): IMapper | null {
  return MAPPERS.find((m) => m.canMap(ctx)) ?? null;
}

export function getAllMappers(): IMapper[] {
  return [...MAPPERS];
}
