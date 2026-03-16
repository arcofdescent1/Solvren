/**
 * HubSpot OAuth state. Re-exports from shared integration OAuth state.
 * @deprecated Prefer importing from @/lib/integrations/oauthState
 */

import {
  type OAuthStatePayload as HubSpotState,
  signOAuthState,
  verifyOAuthState,
} from "@/lib/integrations/oauthState";

export type { HubSpotState };

export function signHubSpotState(input: { orgId: string; userId: string }): string {
  return signOAuthState("hubspot", input);
}

export function verifyHubSpotState(state: string): HubSpotState {
  return verifyOAuthState("hubspot", state);
}
