import { z } from "zod";
import { jsonError, requestOrgRole } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/admin";
import { inQuietHours } from "@/lib/phase3-alerts";

const schema = z.strictObject({
  floorExposureUsd:z.number().min(0).max(10_000_000),
  projectedExposureUsd:z.number().min(0).max(10_000_000),
  dailySpikePct:z.number().min(0).max(1000),
  dailySpikeMinUsd:z.number().min(0).max(10_000_000),
  reconciliationGapUsd:z.number().min(0).max(10_000_000),
  staleHours:z.number().int().min(1).max(168),
  timezone:z.string().min(1).max(80),
  quietStartHour:z.number().int().min(0).max(23),
  quietEndHour:z.number().int().min(0).max(23),
  digestWeekday:z.number().int().min(0).max(6),
  digestHour:z.number().int().min(0).max(23),
});

export async function PUT(request:Request,context:{params:Promise<{orgId:string}>}) {
  const {orgId}=await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.",404);
  const session=await requestOrgRole(orgId,["owner","finance"]);
  if (!session) return jsonError("Finance access with MFA required.",403);
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message??"Invalid alert settings.",400);
  try { new Intl.DateTimeFormat("en-US",{timeZone:parsed.data.timezone}).format(new Date()); }
  catch { return jsonError("Choose a valid IANA timezone.",400); }
  const s=parsed.data;
  if(inQuietHours(s.digestHour,s.quietStartHour,s.quietEndHour))
    return jsonError("Set the weekly digest hour outside quiet hours.",400);
  const {error}=await adminSupabase().from("margin_alert_settings").upsert({
    org_id:orgId,floor_exposure_usd:s.floorExposureUsd,
    projected_exposure_usd:s.projectedExposureUsd,daily_spike_pct:s.dailySpikePct,
    daily_spike_min_usd:s.dailySpikeMinUsd,reconciliation_gap_usd:s.reconciliationGapUsd,
    stale_hours:s.staleHours,timezone:s.timezone,quiet_start_hour:s.quietStartHour,
    quiet_end_hour:s.quietEndHour,digest_weekday:s.digestWeekday,digest_hour:s.digestHour,
    updated_by:session.user.id,updated_at:new Date().toISOString(),
  },{onConflict:"org_id"});
  if (error) return jsonError("Could not save alert settings.",503);
  return Response.json({saved:true});
}
