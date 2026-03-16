/**
 * Jira OAuth state. Re-exports from shared integration OAuth state.
 * @deprecated Prefer importing from @/lib/integrations/oauthState
 */

import {
  type OAuthStatePayload as JiraState,
  signOAuthState,
  verifyOAuthState,
} from "@/lib/integrations/oauthState";

export type { JiraState };

export function signJiraState(input: { orgId: string; userId: string; returnTo?: string }): string {
  return signOAuthState("jira", input);
}

export function verifyJiraState(state: string): JiraState {
  return verifyOAuthState("jira", state);
}
