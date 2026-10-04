import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { adminSupabase } from "@/lib/supabase/admin";
import { AlertSettings, defaultAlertSettings, inQuietHours, localClock } from "@/lib/phase3-alerts";

export const maxDuration=60;
type Db=ReturnType<typeof adminSupabase>;
function authorized(request:Request){
  const secret=process.env.CRON_SECRET;
  const supplied=request.headers.get("authorization")?.replace(/^Bearer /i,"")??"";
  if(!secret||secret.length<32)return false;
  const a=Buffer.from(secret),b=Buffer.from(supplied);
  return a.length===b.length&&timingSafeEqual(a,b);
}
function escape(value:unknown){return String(value??"").replace(/[&<>"']/g,(c)=>({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;",
} as Record<string,string>)[c]);}
function origin(){
  const url=new URL(process.env.APP_ORIGIN??"http://localhost:3000");
  if(process.env.NODE_ENV==="production"&&url.protocol!=="https:")
    throw new Error("HTTPS APP_ORIGIN is required for production mail");
  return url.origin;
}
function configured(){
  const key=process.env.RESEND_API_KEY,from=process.env.ALERT_FROM_EMAIL??process.env.INVITE_FROM_EMAIL;
  if(!key||!from)throw new Error("Alert email delivery is not configured");
  return {resend:new Resend(key),from};
}
async function recipient(db:Db,orgId:string,userId:string){
  const {data:member,error:memberError}=await db.from("organization_members")
    .select("user_id").eq("org_id",orgId).eq("user_id",userId).maybeSingle();
  if(memberError)throw new Error("Could not verify alert recipient membership");
  if(!member)return null;
  const {data,error}=await db.auth.admin.getUserById(userId);
  if(error)throw new Error("Could not verify alert recipient email");
  if(!data.user?.email||!data.user.email_confirmed_at)return null;
  return data.user.email;
}
async function sendAlert(db:Db,job:{delivery_id:number;org_id:string;issue_id:string;
  event_id:number;recipient_user_id:string}){
  const [issueResult,settingsResult]=await Promise.all([
    db.from("margin_issues").select("kind,status,severity,exposure_usd,evidence")
      .eq("org_id",job.org_id).eq("id",job.issue_id).single(),
    db.from("margin_alert_settings").select("*").eq("org_id",job.org_id).maybeSingle(),
  ]);
  if(issueResult.error||!issueResult.data||settingsResult.error)
    throw new Error("Alert evidence is unavailable");
  if(issueResult.data.status==="resolved"){
    const {error}=await db.rpc("phase3_finish_alert_delivery",{
      p_id:job.delivery_id,p_provider_id:null,p_error:"Issue resolved before delivery",
      p_defer_until:null,p_skip:true,
    });
    if(error)throw new Error("Could not skip resolved alert");
    return "skipped";
  }
  const settings=(settingsResult.data??defaultAlertSettings) as AlertSettings;
  const clock=localClock(new Date(),settings.timezone);
  if(inQuietHours(clock.hour,settings.quiet_start_hour,settings.quiet_end_hour)){
    const defer=new Date(Date.now()+60*60_000).toISOString();
    const {error}=await db.rpc("phase3_finish_alert_delivery",{
      p_id:job.delivery_id,p_provider_id:null,p_error:"Deferred for quiet hours",p_defer_until:defer,
    });
    if(error)throw new Error("Could not defer alert during quiet hours");
    return "deferred";
  }
  const email=await recipient(db,job.org_id,job.recipient_user_id);
  if(!email){
    const {error}=await db.rpc("phase3_finish_alert_delivery",{
      p_id:job.delivery_id,p_provider_id:null,p_error:"Recipient no longer eligible",
      p_defer_until:null,p_skip:true,
    });
    if(error)throw new Error("Could not skip ineligible alert");
    return "skipped";
  }
  const issue=issueResult.data;
  const evidence=issue.evidence as {customerName?:string;route?:string;provider?:string};
  const subject=`Solvren: ${issue.kind.replaceAll("_"," ")} · ${evidence.customerName??evidence.provider??"organization"}`;
  const href=new URL(evidence.route??`/o/${job.org_id}/issues`,origin()).toString();
  const {resend,from}=configured();
  const {data,error}=await resend.emails.send({from,to:email,subject,
    html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#18302f"><h1>Margin issue needs review</h1><p><strong>${escape(evidence.customerName??evidence.provider??"Organization")}</strong> has a ${escape(issue.severity)} ${escape(issue.kind.replaceAll("_"," "))}.</p><p>Known exposure: <strong>$${escape(issue.exposure_usd)}</strong>. This is an observed or explicitly labeled run-rate signal; review the underlying evidence before changing contract terms.</p><p><a href="${escape(href)}">Open the issue and evidence in Solvren</a></p><p>You can acknowledge, assign, snooze, or resolve this issue in the workspace.</p></div>`,
    text:`Solvren margin issue: ${issue.kind}. Known exposure $${issue.exposure_usd}. Review ${href}`,
  },{idempotencyKey:`margin-alert-${job.delivery_id}`});
  if(error||!data?.id)throw new Error(`Email provider rejected alert: ${error?.message??"unknown"}`);
  const {error:finishError}=await db.rpc("phase3_finish_alert_delivery",{
    p_id:job.delivery_id,p_provider_id:data.id,p_error:null,p_defer_until:null,
  });
  if(finishError)throw new Error("Alert was sent but its delivery receipt was not saved");
  return "sent";
}
async function sendDigest(db:Db,id:string){
  const {data:job,error:jobError}=await db.from("executive_digests")
    .select("org_id,recipient_user_id,week_start,snapshot").eq("id",id).single();
  if(jobError||!job)throw new Error("Digest evidence is unavailable");
  const email=await recipient(db,job.org_id,job.recipient_user_id);
  if(!email){
    const {error}=await db.rpc("phase3_finish_digest",{
      p_id:id,p_provider_id:null,p_error:"Recipient no longer eligible",p_skip:true,
    });
    if(error)throw new Error("Could not skip ineligible digest");
    return "skipped";
  }
  const snapshot=job.snapshot as {newlyAtRisk:number;exposureChangeUsd:string|null;
    totalExposureUsd:string;resolvedIssues:number;confidenceGaps:number;
    topIssues:Array<{kind:string;customerName:string;exposureUsd:string}>;route:string};
  const href=new URL(snapshot.route,origin()).toString();
  const exposureChange=snapshot.exposureChangeUsd===null
    ?"No prior sent digest for comparison"
    :`${snapshot.exposureChangeUsd} USD change from the previous sent digest`;
  const {resend,from}=configured();
  const {data,error}=await resend.emails.send({from,to:email,
    subject:`Solvren weekly margin review · ${job.week_start}`,
    html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#18302f"><h1>Weekly contract margin review</h1><p>Newly at-risk issues: <strong>${escape(snapshot.newlyAtRisk)}</strong>. Current known exposure: <strong>$${escape(snapshot.totalExposureUsd)}</strong> (${escape(exposureChange)}). Resolved issues: ${escape(snapshot.resolvedIssues)}. Data-confidence gaps: ${escape(snapshot.confidenceGaps)}.</p><h2>Largest open issues</h2><ul>${snapshot.topIssues.map((item)=>`<li>${escape(item.customerName)} · ${escape(item.kind.replaceAll("_"," "))} · $${escape(item.exposureUsd)}</li>`).join("")}</ul><p><a href="${escape(href)}">Review the issues and source evidence</a></p><p>Exposure is an estimate from known direct cost; it is not booked revenue or a savings claim.</p></div>`,
    text:`Newly at risk: ${snapshot.newlyAtRisk}. Current known exposure: $${snapshot.totalExposureUsd}. ${exposureChange}. Resolved: ${snapshot.resolvedIssues}. Data gaps: ${snapshot.confidenceGaps}. Review ${href}`,
  },{idempotencyKey:`margin-digest-${id}`});
  if(error||!data?.id)throw new Error(`Email provider rejected digest: ${error?.message??"unknown"}`);
  const {error:finishError}=await db.rpc("phase3_finish_digest",{
    p_id:id,p_provider_id:data.id,p_error:null,
  });
  if(finishError)throw new Error("Digest was sent but its delivery receipt was not saved");
  return "sent";
}
async function run(request:Request){
  if(!authorized(request))return Response.json({error:"Unauthorized"},{status:401});
  let db:Db;
  try{db=adminSupabase();}catch{return Response.json({error:"Delivery not configured"},{status:503});}
  const until=Date.now()+42_000;
  let sent=0,deferred=0,skipped=0,failed=0;
  while(sent+deferred+skipped+failed<8&&Date.now()<until){
    const {data,error}=await db.rpc("phase3_claim_alert_delivery");
    if(error)return Response.json({error:"Could not claim alert delivery",sent,failed},{status:503});
    const job=data?.[0];
    if(!job)break;
    try{const result=await sendAlert(db,job);if(result==="sent")sent++;
      else if(result==="deferred")deferred++;else skipped++;}
    catch(reason){failed++;await db.rpc("phase3_finish_alert_delivery",{
      p_id:job.delivery_id,p_provider_id:null,p_error:reason instanceof Error?reason.message:"Alert failed",
      p_defer_until:null,
    });}
  }
  if(Date.now()<until){
    const {data:id,error}=await db.rpc("phase3_claim_digest");
    if(error)return Response.json({error:"Could not claim digest",sent,failed},{status:503});
    if(id){try{const result=await sendDigest(db,id);if(result==="sent")sent++;else skipped++;}
      catch(reason){failed++;await db.rpc("phase3_finish_digest",{
        p_id:id,p_provider_id:null,p_error:reason instanceof Error?reason.message:"Digest failed",
      });}}
  }
  return Response.json({sent,deferred,skipped,failed});
}
export const GET=run;export const POST=run;
