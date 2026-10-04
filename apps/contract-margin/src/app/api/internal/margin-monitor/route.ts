import { randomUUID, timingSafeEqual } from "node:crypto";
import Decimal from "decimal.js";
import { adminSupabase } from "@/lib/supabase/admin";
import { alertCandidates, AlertSettings, defaultAlertSettings, localClock } from "@/lib/phase3-alerts";
import { PortfolioRow } from "@/lib/finance";
import { ContractTerms, DailyCost } from "@/lib/phase3-forecast";

export const maxDuration=60;
type Db=ReturnType<typeof adminSupabase>;
function authorized(request:Request){
  const secret=process.env.CRON_SECRET;
  const supplied=request.headers.get("authorization")?.replace(/^Bearer /i,"")??"";
  if(!secret||secret.length<32)return false;
  const a=Buffer.from(secret),b=Buffer.from(supplied);
  return a.length===b.length&&timingSafeEqual(a,b);
}

async function digestIfDue(db:Db,orgId:string,settings:AlertSettings,
  portfolio:PortfolioRow[],now:Date){
  const clock=localClock(now,settings.timezone);
  if(clock.weekday!==settings.digest_weekday||clock.hour<settings.digest_hour)return;
  const localDate=new Date(`${clock.date}T00:00:00Z`);
  localDate.setUTCDate(localDate.getUTCDate()-((clock.weekday+6)%7));
  const weekStart=localDate.toISOString().slice(0,10);
  const [summaryResult,membersResult,previousResult]=await Promise.all([
    db.rpc("phase3_digest_summary",{p_org:orgId,
      p_since:new Date(now.valueOf()-7*86400_000).toISOString()}),
    db.from("organization_members").select("user_id,role").eq("org_id",orgId)
      .in("role",["owner","finance"]),
    db.from("executive_digests").select("snapshot").eq("org_id",orgId)
      .lt("week_start",weekStart).eq("status","sent")
      .order("week_start",{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(summaryResult.error||membersResult.error||previousResult.error)
    throw new Error("Digest evidence unavailable");
  const summary=summaryResult.data?.[0];
  if(!summary)throw new Error("Digest summary unavailable");
  const exposure=new Decimal(summary.total_exposure_usd);
  const previous=previousResult.data?.snapshot as {totalExposureUsd?:string}|undefined;
  const change=previous?.totalExposureUsd
    ?exposure.minus(previous.totalExposureUsd).toFixed(2):null;
  const confidenceGaps=Number(summary.confidence_gap_issues)
    + portfolio.reduce((sum,row)=>sum+Number(row.unknown_cost_events>0),0);
  const snapshot={weekStart,generatedAt:now.toISOString(),
    newlyAtRisk:Number(summary.newly_at_risk),
    exposureChangeUsd:change,totalExposureUsd:exposure.toFixed(2),
    resolvedIssues:Number(summary.resolved_issues),confidenceGaps,
    topIssues:summary.top_issues,
    route:`/o/${orgId}/issues`};
  for(const member of membersResult.data??[]){
    const {error}=await db.from("executive_digests").upsert({
      org_id:orgId,recipient_user_id:member.user_id,week_start:weekStart,snapshot,
    },{onConflict:"org_id,recipient_user_id,week_start",ignoreDuplicates:true});
    if(error)throw new Error("Could not queue executive digest");
  }
}

async function monitor(db:Db,orgId:string){
  const now=new Date();
  const end=new Date(now);end.setUTCHours(0,0,0,0);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-30);
  const from=start.toISOString().slice(0,10),to=end.toISOString().slice(0,10);
  const [orgResult,portfolioResult,dailyResult,reconciliationResult,
    connectionsResult,settingsResult]=await Promise.all([
    db.from("organizations").select("target_margin_pct").eq("id",orgId).single(),
    db.rpc("phase1_portfolio",{p_org:orgId,p_start:from,p_end:to}),
    db.rpc("phase3_daily_costs",{p_org:orgId,p_start:from,p_end:to}),
    db.rpc("phase2_reconciliation",{p_org:orgId,p_start:from,p_end:to}),
    db.from("provider_connections").select("provider,connected_at,disconnected_at,last_success_at,last_error")
      .eq("org_id",orgId),
    db.from("margin_alert_settings").select("*").eq("org_id",orgId).maybeSingle(),
  ]);
  if(orgResult.error||!orgResult.data||portfolioResult.error||dailyResult.error||
    reconciliationResult.error||connectionsResult.error||settingsResult.error)
    throw new Error("Margin monitor source query failed");
  const contracts=new Map<string,ContractTerms>();
  for(let offset=0;;offset+=1000){
    const {data,error}=await db.from("contract_versions")
      .select("customer_id,effective_from,effective_to,billing_period,base_fee_usd,included_outcomes,overage_usd,discount_pct,target_margin_pct")
      .eq("org_id",orgId).lte("effective_from",to)
      .order("effective_from",{ascending:false}).order("id",{ascending:false})
      .range(offset,offset+999);
    if(error)throw new Error("Margin monitor contract query failed");
    for(const item of data??[]){
      if(!contracts.has(item.customer_id)&&(!item.effective_to||item.effective_to>to))
        contracts.set(item.customer_id,item);
    }
    if((data?.length??0)<1000)break;
  }
  const settings=(settingsResult.data??defaultAlertSettings) as AlertSettings;
  const portfolio=(portfolioResult.data??[]) as PortfolioRow[];
  const candidates=alertCandidates({portfolio,daily:(dailyResult.data??[]) as DailyCost[],
    contracts,connections:connectionsResult.data??[],
    reconciliation:reconciliationResult.data??[],settings,
    defaultTarget:String(orgResult.data.target_margin_pct),orgId,asOf:now});
  const scan=randomUUID();
  for(const candidate of candidates){
    const {error}=await db.rpc("phase3_observe_issue",{
      p_org:orgId,p_scan:scan,p_customer:candidate.customerId,p_kind:candidate.kind,
      p_severity:candidate.severity,p_exposure:candidate.exposureUsd,
      p_evidence:candidate.evidence,
    });
    if(error)throw new Error("Could not record margin issue");
  }
  const {error:finishError}=await db.rpc("phase3_finish_issue_scan",{p_org:orgId,p_scan:scan});
  if(finishError)throw new Error("Could not complete margin issue scan");
  await digestIfDue(db,orgId,settings,portfolio,now);
  return candidates.length;
}

async function run(request:Request){
  if(!authorized(request))return Response.json({error:"Unauthorized"},{status:401});
  let db:Db;
  try{db=adminSupabase();}catch{return Response.json({error:"Monitor not configured"},{status:503});}
  const until=Date.now()+45_000;
  let scanned=0,observed=0,failed=0;
  while(scanned+failed<5&&Date.now()<until){
    const {data:orgId,error}=await db.rpc("phase3_claim_monitor");
    if(error)return Response.json({error:"Could not claim monitor work",scanned,failed},{status:503});
    if(!orgId)break;
    try{observed+=await monitor(db,orgId);scanned++;
      const {error:done}=await db.rpc("phase3_finish_monitor",{p_org:orgId,p_error:null});
      if(done)throw new Error("Could not checkpoint monitor work");
    }catch(reason){failed++;await db.rpc("phase3_finish_monitor",{
      p_org:orgId,p_error:reason instanceof Error?reason.message:"Monitor failed",
    });}
  }
  return Response.json({scanned,observed,failed});
}
export const GET=run;export const POST=run;
