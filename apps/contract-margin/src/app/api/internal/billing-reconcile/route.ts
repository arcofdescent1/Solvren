import { randomUUID,timingSafeEqual } from "node:crypto";
import { configuredPrice,customerSubscriptions,subscription,
  subscriptionState } from "@/lib/billing";
import { adminSupabase } from "@/lib/supabase/admin";

export const maxDuration=60;
function authorized(request:Request){
  const secret=process.env.CRON_SECRET;
  const supplied=request.headers.get("authorization")?.replace(/^Bearer /i,"")??"";
  if(!secret||secret.length<32)return false;
  const a=Buffer.from(secret),b=Buffer.from(supplied);
  return a.length===b.length&&timingSafeEqual(a,b);
}
async function run(request:Request){
  if(!authorized(request))return Response.json({error:"Unauthorized"},{status:401});
  const db=adminSupabase();
  const {data:rows,error}=await db.from("organization_billing")
    .select("org_id,stripe_customer_id,stripe_subscription_id")
    .not("stripe_customer_id","is",null).order("updated_at",{ascending:true}).limit(20);
  if(error)return Response.json({error:"Billing reconciliation unavailable"},{status:503});
  let reconciled=0,unresolved=0;
  for(const row of rows??[]){
    try{
      const customer=row.stripe_customer_id;
      if(!customer)continue;
      const subscriptions=await customerSubscriptions(customer);
      const candidates=subscriptions.filter((item)=>item.status!=="canceled");
      if(candidates.length>1)throw new Error("Multiple live subscriptions");
      const chosen=candidates[0]??subscriptions.find((item)=>
        item.id===row.stripe_subscription_id)??subscriptions[0];
      if(!chosen){
        await db.from("organization_billing").update({updated_at:new Date().toISOString()})
          .eq("org_id",row.org_id);
        continue;
      }
      const current=await subscription(chosen.id);
      if(current.customer!==customer)throw new Error("Customer mismatch");
      const state=subscriptionState(current);
      if(![configuredPrice("month"),configuredPrice("year")].includes(state.priceId))
        throw new Error("Unrecognized price");
      const {error:applyError}=await db.rpc("phase4_apply_billing_event",{
        p_org:row.org_id,
        p_event_id:`evt_reconcile${randomUUID().replaceAll("-","")}`,
        p_type:"billing.reconciled",p_created:Math.floor(Date.now()/1000),
        p_customer:customer,p_subscription:chosen.id,p_price:state.priceId,
        p_interval:state.interval,p_status:state.status,p_period_end:state.periodEnd,
        p_cancel_at_period_end:state.cancelAtPeriodEnd,
        p_invoice_status:state.invoiceStatus,
      });
      if(applyError)throw new Error("Entitlement update failed");
      reconciled++;
    }catch{unresolved++;}
  }
  return Response.json({reconciled,unresolved,scanned:rows?.length??0},
    {status:unresolved?503:200});
}
export const GET=run;export const POST=run;
