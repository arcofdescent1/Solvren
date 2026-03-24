import type { SupabaseClient } from "@supabase/supabase-js";
import { PURGE_STEP_ORDER, type PurgeStepKey } from "./types";
import {
  markPurgeRunStepRunning,
  markPurgeRunStepFinished,
  updatePurgeRun,
  listPurgeRunSteps,
} from "./org-purge.repository";
import type { OrgPurgeStepContext } from "./step-context";
import { runQuiesceOrgStep } from "./steps/quiesce-org.step";
import { runPurgeQueuesStep } from "./steps/purge-queues.step";
import { runPurgeIntegrationsStep } from "./steps/purge-integrations.step";
import { runPurgeBillingStep } from "./steps/purge-billing.step";
import { runPurgeIdentityAccessStep } from "./steps/purge-identity-access.step";
import { runPurgeObjectStorageStep } from "./steps/purge-object-storage.step";
import { runPurgeDatabaseStep } from "./steps/purge-database.step";

const STEP_RUNNERS: Record<PurgeStepKey, (ctx: OrgPurgeStepContext) => Promise<Record<string, unknown>>> = {
  quiesce_org: runQuiesceOrgStep,
  purge_queues: runPurgeQueuesStep,
  purge_integrations: runPurgeIntegrationsStep,
  purge_billing: runPurgeBillingStep,
  purge_identity_access: runPurgeIdentityAccessStep,
  purge_object_storage: runPurgeObjectStorageStep,
  purge_database: runPurgeDatabaseStep,
};

export async function executeOrgPurgeRun(input: {
  admin: SupabaseClient;
  runId: string;
  orgId: string;
  actorUserId: string;
}): Promise<{ ok: boolean; failedStep?: PurgeStepKey; message?: string }> {
  await updatePurgeRun(input.admin, input.runId, { status: "running" });

  const { data: existingSteps } = await listPurgeRunSteps(input.admin, input.runId);
  const completed = new Set(
    (existingSteps ?? []).filter((s) => s.status === "completed").map((s) => s.step_key as PurgeStepKey)
  );

  for (const stepKey of PURGE_STEP_ORDER) {
    if (completed.has(stepKey)) continue;

    const runErr = await markPurgeRunStepRunning(input.admin, input.runId, stepKey);
    if (runErr.error) {
      await updatePurgeRun(input.admin, input.runId, {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: runErr.error.message,
      });
      return { ok: false, failedStep: stepKey, message: runErr.error.message };
    }

    const ctx: OrgPurgeStepContext = {
      admin: input.admin,
      orgId: input.orgId,
      runId: input.runId,
      actorUserId: input.actorUserId,
      dryRun: false,
      stepKey,
    };

    try {
      const detail = await STEP_RUNNERS[stepKey](ctx);
      await markPurgeRunStepFinished(input.admin, input.runId, stepKey, {
        status: "completed",
        detail_json: detail,
      });
      completed.add(stepKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markPurgeRunStepFinished(input.admin, input.runId, stepKey, {
        status: "failed",
        detail_json: {},
        error: msg,
      });
      await updatePurgeRun(input.admin, input.runId, {
        status: "partial",
        completed_at: new Date().toISOString(),
        error_message: msg,
      });
      return { ok: false, failedStep: stepKey, message: msg };
    }
  }

  await updatePurgeRun(input.admin, input.runId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    summary_json: { steps: [...PURGE_STEP_ORDER] },
    error_message: null,
  });
  return { ok: true };
}
