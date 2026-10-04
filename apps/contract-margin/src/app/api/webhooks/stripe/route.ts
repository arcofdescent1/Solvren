import { z } from "zod";
import { configuredPrice,customerSubscriptions,subscription,subscriptionState,
  verifyStripeSignature } from "@/lib/billing";
import { adminSupabase } from "@/lib/supabase/admin";

type Event={id:string;type:string;created:number;livemode:boolean;
  data:{object:Record<string,unknown>}};
const accepted=new Set(["checkout.session.completed","customer.subscription.created",
  "customer.subscription.updated","customer.subscription.deleted",
  "invoice.paid","invoice.payment_failed","invoice.payment_succeeded",
  "charge.refunded"]);
export async function POST(request:Request){
  const raw=await request.text();
  if(raw.length>500_000)return Response.json({error:"Event too large"},{status:413});
  if(!verifyStripeSignature(raw,request.headers.get("stripe-signature")))
    return Response.json({error:"Invalid signature"},{status:400});
  let event:Event;
  try{event=JSON.parse(raw) as Event;}catch{return Response.json({error:"Invalid event"},{status:400});}
  if(!/^evt_[a-zA-Z0-9]+$/.test(event.id)||!Number.isSafeInteger(event.created)||
    typeof event.type!=="string"||!event.data?.object)
    return Response.json({error:"Invalid event envelope"},{status:400});
  if(event.livemode!==process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"))
    return Response.json({error:"Billing environment mismatch"},{status:400});
  if(!accepted.has(event.type))return Response.json({received:true,ignored:true});
  const db=adminSupabase();
  const {data:seen,error:seenError}=await db.from("billing_webhook_events")
    .select("stripe_event_id").eq("stripe_event_id",event.id).maybeSingle();
  if(seenError)return Response.json({error:"Event ledger unavailable"},{status:503});
  if(seen)return Response.json({received:true,duplicate:true});
  try{
    const object=event.data.object;
    const customer=typeof object.customer==="string"?object.customer:null;
    const orgHint=typeof object.client_reference_id==="string"?object.client_reference_id:
      typeof (object.metadata as Record<string,unknown>|undefined)?.solvren_org_id==="string"
        ?String((object.metadata as Record<string,unknown>).solvren_org_id):null;
    const subHint=event.type.startsWith("customer.subscription")?String(object.id??""):
      typeof object.subscription==="string"?object.subscription:null;
    let orgId:string|null=null;
    if(customer){
      const {data:known,error}=await db.from("organization_billing")
        .select("org_id").eq("stripe_customer_id",customer).maybeSingle();
      if(error)throw new Error("Billing customer lookup failed");
      orgId=known?.org_id??null;
    }
    if(!orgId&&orgHint&&z.uuid().safeParse(orgHint).success){
      const {data:known,error}=await db.from("organization_billing")
        .select("org_id,stripe_customer_id").eq("org_id",orgHint).maybeSingle();
      if(error)throw new Error("Billing organization lookup failed");
      if(known&&(!known.stripe_customer_id||known.stripe_customer_id===customer))orgId=known.org_id;
    }
    if(!orgId||!customer)return Response.json({received:true,ignored:true});
    if(event.type==="charge.refunded"){
      const charge=typeof object.id==="string"?object.id:"";
      const amount=Number(object.amount_refunded??0);
      const {error}=await db.rpc("phase4_record_refund",{
        p_org:orgId,p_event_id:event.id,p_created:event.created,
        p_customer:customer,p_charge:charge,p_amount:amount,
      });
      if(error)throw new Error("Could not record billing refund");
      return Response.json({received:true});
    }
    const {data:billing,error:billingError}=await db.from("organization_billing")
      .select("stripe_subscription_id").eq("org_id",orgId).single();
    if(billingError||!billing)throw new Error("Billing state unavailable");
    let subId=subHint;
    if(!subId&&event.type==="checkout.session.completed"&&
      typeof object.subscription==="string")subId=object.subscription;
    if(!subId)subId=billing.stripe_subscription_id;
    if(!subId){
      const list=await customerSubscriptions(customer);
      subId=list.find((item)=>item.status==="active")?.id??list[0]?.id??null;
    }
    if(!subId)return Response.json({received:true,ignored:true});
    const current=await subscription(subId);
    if(current.customer!==customer)throw new Error("Subscription customer mismatch");
    const state=subscriptionState(current);
    const monthly=configuredPrice("month"),annual=configuredPrice("year");
    if(state.priceId!==monthly&&state.priceId!==annual)
      return Response.json({received:true,ignored:true});
    const {error}=await db.rpc("phase4_apply_billing_event",{
      p_org:orgId,p_event_id:event.id,p_type:event.type,p_created:event.created,
      p_customer:customer,p_subscription:current.id,p_price:state.priceId,
      p_interval:state.interval,p_status:state.status,p_period_end:state.periodEnd,
      p_cancel_at_period_end:state.cancelAtPeriodEnd,
      p_invoice_status:state.invoiceStatus,
    });
    if(error)throw new Error("Could not apply billing entitlement");
    return Response.json({received:true});
  }catch{
    return Response.json({error:"Billing reconciliation failed"},{status:503});
  }
}
