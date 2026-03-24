/**
 * Phase 3 — HubSpot create_task action handler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubSpotClientForOrg } from "../hubspotClientForOrg";
import type { ActionExecutionResult } from "../../../contracts/runtime";

const ASSOCIATION_TYPES: Record<string, "contact" | "deal" | "company"> = {
  contact: "contact",
  deal: "deal",
  company: "company",
};

export async function executeHubSpotCreateTask(
  _admin: SupabaseClient,
  input: {
    orgId: string;
    params: Record<string, unknown>;
  }
): Promise<ActionExecutionResult> {
  const subject = input.params.subject as string | undefined;
  const ownerId = input.params.ownerId as string | undefined;
  const associationType = input.params.associationType as string | undefined;
  const associationId = input.params.associationId as string | undefined;
  const dueDate = input.params.dueDate as string | undefined;

  if (!subject?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "subject is required" };
  }
  if (!ownerId?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "ownerId is required" };
  }
  if (!associationType?.trim() || !associationId?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "associationType and associationId are required" };
  }

  const mappedType = ASSOCIATION_TYPES[associationType.toLowerCase()] ?? "contact";

  const result = await getHubSpotClientForOrg(input.orgId);
  if (!result) {
    return { success: false, errorCode: "NOT_FOUND", errorMessage: "HubSpot not connected" };
  }

  try {
    const task = await result.client.createTask({
      subject: subject.trim(),
      ownerId: ownerId.trim(),
      dueDate: dueDate?.trim() || undefined,
      associationType: mappedType,
      associationId: associationId.trim(),
    });
    return {
      success: true,
      externalId: task.id,
      message: `Task ${task.id} created`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "HubSpot API failed";
    const code =
      msg.includes("401") || msg.includes("403")
        ? "AUTH_ERROR"
        : msg.includes("404") || msg.includes("not found")
          ? "NOT_FOUND"
          : "PROVIDER_ERROR";
    return { success: false, errorCode: code, errorMessage: msg };
  }
}
