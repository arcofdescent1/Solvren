import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawIntegrationEvent } from "./types";
import { normalizeEvent } from "./EventNormalizer";
import { evaluateRisk } from "./RiskEvaluator";
import { storeRiskEvent } from "./RiskEventStore";
import { createRiskAlertIfNeeded } from "./RiskAlertService";
import { enqueueRiskAlertNotifications } from "@/services/notifications/enqueueRiskAlert";

export type PublishResult = { eventId: string; alertId?: string };

export async function publishIntegrationEvent(
  client: SupabaseClient,
  orgId: string,
  raw: RawIntegrationEvent
): Promise<PublishResult> {
  const normalized = normalizeEvent(raw);
  const { riskScore, riskBucket } = evaluateRisk(normalized);
  const event: Omit<import("./types").CanonicalRiskEvent, "id"> = {
    ...normalized,
    riskScore,
    riskBucket,
  };
  const eventId = await storeRiskEvent(client, orgId, event);
  const alertId = await createRiskAlertIfNeeded(client, orgId, eventId, riskScore, riskBucket);

  if (alertId) {
    await enqueueRiskAlertNotifications(client, orgId, {
      riskEventId: eventId,
      riskAlertId: alertId,
      provider: event.provider,
      riskType: event.riskType,
      riskBucket,
      impactAmount: event.impactAmount,
      object: event.object,
      objectId: event.objectId,
    });
  }

  return { eventId, alertId: alertId ?? undefined };
}
