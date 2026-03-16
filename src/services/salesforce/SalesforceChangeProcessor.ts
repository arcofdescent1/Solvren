/**
 * Salesforce Change Processor - Phase 6.
 * Processes CDC/Streaming events and maps to governance workflows.
 */
export type CrmChangeEvent = {
  provider: "salesforce";
  object: string;
  objectId: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  riskType?: string;
};

export async function processSalesforceChange(
  _supabase: unknown,
  _orgId: string,
  _event: CrmChangeEvent
): Promise<void> {
  await Promise.resolve();
}
