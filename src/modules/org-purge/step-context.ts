import type { SupabaseClient } from "@supabase/supabase-js";
import type { PurgeStepKey } from "./types";

export type OrgPurgeStepContext = {
  admin: SupabaseClient;
  orgId: string;
  runId: string;
  actorUserId: string;
  dryRun: boolean;
  /** Current step (for nested helpers). */
  stepKey: PurgeStepKey;
};
