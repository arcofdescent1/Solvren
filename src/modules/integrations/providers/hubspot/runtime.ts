/**
 * Phase 1 — HubSpot connector runtime stub.
 * Full implementation will wrap existing HubSpot IES logic.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";

export function getHubSpotRuntime(): ConnectorRuntime {
  return createStubRuntime("hubspot");
}
