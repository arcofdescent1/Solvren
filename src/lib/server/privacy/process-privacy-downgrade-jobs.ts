/**
 * Phase 5 — Process org_privacy_jobs (expanded → minimal). Idempotent; uses service role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { recordTrustComplianceEvent } from "@/lib/server/trust/trust-compliance-events";

export type PrivacyJobProcessResult = { claimed: boolean; jobId?: string; error?: string };

async function minimizeRawEventsPayloadsForOrg(admin: SupabaseClient, orgId: string): Promise<void> {
  const batch = 400;
  let lastId = "";
  for (;;) {
    let q = admin
      .from("raw_events")
      .select("id, sanitized_payload")
      .eq("org_id", orgId)
      .order("id", { ascending: true })
      .limit(batch);
    if (lastId) q = q.gt("id", lastId);
    const { data: rows } = await q;

    if (!rows?.length) break;

    for (const r of rows) {
      const row = r as { id: string; sanitized_payload?: unknown };
      const replacement =
        row.sanitized_payload && typeof row.sanitized_payload === "object"
          ? row.sanitized_payload
          : { _privacy_minimized: true, ref: row.id };
      await admin.from("raw_events").update({ payload_json: replacement }).eq("id", row.id);
    }

    lastId = (rows[rows.length - 1] as { id: string }).id;
    if (rows.length < batch) break;
  }
}

export async function processNextPrivacyDowngradeJob(admin: SupabaseClient): Promise<PrivacyJobProcessResult> {
  const { data: candidate, error: selErr } = await admin
    .from("org_privacy_jobs")
    .select("id, org_id, job_type, status")
    .eq("status", "queued")
    .eq("job_type", "downgrade_to_minimal")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr || !candidate) {
    return { claimed: false };
  }

  const job = candidate as { id: string; org_id: string };
  const { data: locked, error: lockErr } = await admin
    .from("org_privacy_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();

  if (lockErr || !locked) {
    return { claimed: false };
  }

  const orgId = job.org_id;

  try {
    const { data: org } = await admin.from("organizations").select("privacy_mode").eq("id", orgId).maybeSingle();
    const mode = String((org as { privacy_mode?: string } | null)?.privacy_mode ?? "minimal");
    if (mode !== "minimal") {
      await admin
        .from("org_privacy_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: "Organization is not in minimal privacy mode; refusing side effects",
        })
        .eq("id", job.id);
      await recordTrustComplianceEvent({
        orgId,
        eventType: "privacy_downgrade_failed",
        metadata: { jobId: job.id, reason: "privacy_mode_mismatch" },
      });
      return { claimed: true, jobId: job.id, error: "privacy_mode_mismatch" };
    }

    await minimizeRawEventsPayloadsForOrg(admin, orgId);

    await admin
      .from("issue_impact_summaries")
      .update({ privacy_policy_version: "p5-v1" })
      .eq("org_id", orgId);

    await admin
      .from("org_privacy_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", job.id);

    await recordTrustComplianceEvent({
      orgId,
      eventType: "privacy_downgrade_completed",
      metadata: { jobId: job.id },
    });

    return { claimed: true, jobId: job.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    await admin
      .from("org_privacy_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: msg,
      })
      .eq("id", job.id);
    await recordTrustComplianceEvent({
      orgId,
      eventType: "privacy_downgrade_failed",
      metadata: { jobId: job.id, error: msg },
    });
    return { claimed: true, jobId: job.id, error: msg };
  }
}

export async function runPrivacyDowngradeSweep(maxJobs = 10): Promise<{ processed: number; errors: string[] }> {
  const admin = createPrivilegedClient("privacy downgrade sweep");
  let processed = 0;
  const errors: string[] = [];
  for (let i = 0; i < maxJobs; i++) {
    const r = await processNextPrivacyDowngradeJob(admin);
    if (!r.claimed) break;
    processed++;
    if (r.error) errors.push(r.error);
  }
  return { processed, errors };
}
