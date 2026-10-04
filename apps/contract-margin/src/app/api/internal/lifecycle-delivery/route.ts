import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { adminSupabase } from "@/lib/supabase/admin";
import { appOrigin } from "@/lib/billing";

export const maxDuration=60;
type Db=ReturnType<typeof adminSupabase>;
type Job={delivery_id:string;org_id:string|null;template:string;
  recipient_email:string;payload:Record<string,unknown>};
function authorized(request:Request){
  const secret=process.env.CRON_SECRET;
  const supplied=request.headers.get("authorization")?.replace(/^Bearer /i,"")??"";
  if(!secret||secret.length<32)return false;
  const a=Buffer.from(secret),b=Buffer.from(supplied);
  return a.length===b.length&&timingSafeEqual(a,b);
}
function escape(value:unknown){return String(value??"").replace(/[&<>"']/g,(character)=>({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;",
} as Record<string,string>)[character]);}
function mail(){
  const key=process.env.RESEND_API_KEY;
  const from=process.env.LIFECYCLE_FROM_EMAIL??process.env.INVITE_FROM_EMAIL;
  if(!key||!from)throw new Error("Lifecycle email is not configured");
  return {resend:new Resend(key),from};
}
async function stillEligible(db:Db,job:Job){
  if(!job.org_id||job.template==="support_case")return true;
  const {data:owner,error}=await db.from("organization_members")
    .select("user_id").eq("org_id",job.org_id).eq("role","owner").maybeSingle();
  if(error)throw new Error("Lifecycle recipient lookup failed");
  if(!owner)return false;
  const {data:user,error:userError}=await db.auth.admin.getUserById(owner.user_id);
  if(userError)throw new Error("Lifecycle recipient verification failed");
  return !!user.user?.email_confirmed_at&&
    user.user.email?.toLowerCase()===job.recipient_email.toLowerCase();
}
function content(job:Job){
  const origin=appOrigin();
  const org=job.org_id;
  const route=job.template==="support_case"?"/support":
    job.template==="incident"?"/status":
    job.template==="source_failure"?`/o/${org}/${job.payload.sourceType==="import_jobs"?"data":"reconcile"}`:
    job.template==="first_report"?`/o/${org}/reconcile`:
    `/${org?`o/${org}/billing`:"pricing"}`;
  const link=new URL(route,origin).toString();
  let subject="Solvren account update",body="Review your account in Solvren.";
  switch(job.template){
    case "source_failure":subject="Solvren source needs attention";
      body=`A ${String(job.payload.source??"data")} import or connection failed. Review its job status and source health before using the affected report.`;break;
    case "first_report":subject="Your first Solvren report is ready";
      body="Your first frozen report is ready to review. Check its source coverage and confidence status before making a decision.";break;
    case "trial_expiring":subject="Your Solvren trial ends within 24 hours";
      body="Your trial is nearly over. Subscribe to keep importing and saving decisions without reimporting existing data.";break;
    case "trial_expired":subject="Your Solvren trial is now read-only";
      body="Your trial has ended. Existing data remains readable. Subscribe to resume imports, calculations, and saved decisions.";break;
    case "billing_failure":subject="Action needed for your Solvren payment";
      body="Stripe reported a payment problem for your subscription. Review payment details in the billing portal. Your access state is shown in Solvren.";break;
    case "cancellation":subject="Your Solvren subscription was canceled";
      body="Your subscription was canceled. Data is read-only after paid access ends and is scheduled for deletion within 29 days unless access is reinstated. Export any records you need.";break;
    case "support_case":subject=`Solvren support case ${String(job.payload.caseId??"")}`;
      body=`We recorded support case ${String(job.payload.caseId??"")}. The first-response target is ${String(job.payload.expectedResponseAt??"")}. Keep this case ID for follow-up.`;break;
    case "incident":subject="Solvren service incident update";
      body=`A published Solvren incident changed to ${String(job.payload.state??"investigating")}. Review the status page for the current customer-safe update.`;break;
    default:throw new Error("Unknown lifecycle template");
  }
  return {subject,body,link};
}
async function deliver(db:Db,job:Job){
  if(!await stillEligible(db,job)){
    const {error}=await db.rpc("phase4_finish_lifecycle",{
      p_id:job.delivery_id,p_provider_id:null,p_error:"Recipient no longer eligible",p_skip:true});
    if(error)throw new Error("Could not skip lifecycle delivery");
    return "skipped";
  }
  const {resend,from}=mail();
  const {subject,body,link}=content(job);
  const {data,error}=await resend.emails.send({from,to:job.recipient_email,subject,
    html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#18302f"><h1>${escape(subject)}</h1><p>${escape(body)}</p><p><a href="${escape(link)}">Open Solvren</a></p><p>This message contains no customer financial records. Sign in to review the underlying evidence.</p></div>`,
    text:`${subject}\n\n${body}\n\n${link}`,
  },{idempotencyKey:`solvren-lifecycle-${job.delivery_id}`});
  if(error||!data?.id)throw new Error(`Lifecycle email rejected: ${error?.message??"unknown"}`);
  if(job.template==="support_case"){
    const operator=process.env.SUPPORT_TO_EMAIL;
    if(!operator)throw new Error("Support notification address is not configured");
    const notification=await resend.emails.send({from,to:operator,
      subject:`New Solvren support case ${String(job.payload.caseId??"")}`,
      html:`<p>Case ${escape(job.payload.caseId)} was recorded. <a href="${escape(new URL("/operator",appOrigin()).toString())}">Open restricted operator diagnostics</a>.</p>`,
      text:`Case ${String(job.payload.caseId??"")} was recorded. Open ${new URL("/operator",appOrigin())}`,
    },{idempotencyKey:`solvren-lifecycle-operator-${job.delivery_id}`});
    if(notification.error||!notification.data?.id)
      throw new Error(`Support notification rejected: ${notification.error?.message??"unknown"}`);
  }
  const {error:finishError}=await db.rpc("phase4_finish_lifecycle",{
    p_id:job.delivery_id,p_provider_id:data.id,p_error:null,p_skip:false});
  if(finishError)throw new Error("Lifecycle email sent but receipt not saved");
  return "sent";
}
async function run(request:Request){
  if(!authorized(request))return Response.json({error:"Unauthorized"},{status:401});
  let db:Db;
  try{db=adminSupabase();}catch{return Response.json({error:"Delivery not configured"},{status:503});}
  const {error:queueError}=await db.rpc("phase4_queue_trial_notices");
  if(queueError)return Response.json({error:"Trial notice scan failed"},{status:503});
  const until=Date.now()+42_000;
  let sent=0,skipped=0,failed=0;
  while(sent+skipped+failed<8&&Date.now()<until){
    const {data,error}=await db.rpc("phase4_claim_lifecycle");
    if(error)return Response.json({error:"Could not claim lifecycle mail",sent,failed},{status:503});
    const job=data?.[0] as Job|undefined;
    if(!job)break;
    try{const result=await deliver(db,job);if(result==="sent")sent++;else skipped++;}
    catch(reason){failed++;await db.rpc("phase4_finish_lifecycle",{
      p_id:job.delivery_id,p_provider_id:null,
      p_error:reason instanceof Error?reason.message:"Lifecycle delivery failed",p_skip:false,
    });}
  }
  return Response.json({sent,skipped,failed});
}
export const GET=run;export const POST=run;
