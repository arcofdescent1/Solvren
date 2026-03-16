import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoordinationPlan } from "./coordinationTypes";

export async function applyNotificationSuggestions(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  plan: CoordinationPlan;
}) {
  // v1: structured routing intent only; no direct dispatch here.
  // We return the routing rows so caller can audit and optionally persist later.
  const recipients = args.plan.notifications.suggestedRecipients;
  return {
    applied: recipients.length,
    recipients,
  };
}
