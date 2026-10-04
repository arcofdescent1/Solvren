import { createHmac,timingSafeEqual } from "node:crypto";

type StripeObject={id:string;object:string;[key:string]:unknown};
type StripePrice=StripeObject&{active:boolean;currency:string;unit_amount:number|null;
  recurring:{interval:string}|null};
export type StripeSubscription=StripeObject&{customer:string;status:string;
  cancel_at_period_end:boolean;current_period_end?:number;
  items:{data:Array<{price:{id:string;recurring?:{interval:string}};
    current_period_end?:number}>};latest_invoice?:string|{status:string;attempted?:boolean;
    amount_remaining?:number}|null};
type StripeList<T>={data:T[];has_more:boolean};

function secret(){
  const value=process.env.STRIPE_SECRET_KEY;
  if(!value||!/^sk_(test|live)_/.test(value))throw new Error("Stripe billing is not configured");
  return value;
}
export function appOrigin(){
  const origin=new URL(process.env.APP_ORIGIN??"http://localhost:3000");
  if(process.env.NODE_ENV==="production"&&origin.protocol!=="https:")
    throw new Error("HTTPS APP_ORIGIN is required for billing");
  return origin.origin;
}
export async function stripeGet<T>(path:string,query?:URLSearchParams):Promise<T>{
  const response=await fetch(`https://api.stripe.com/v1/${path}${query?`?${query}`:""}`,{
    headers:{Authorization:`Bearer ${secret()}`},cache:"no-store"});
  const body=await response.json();
  if(!response.ok)throw new Error(`Stripe request failed: ${body.error?.message??response.status}`);
  return body as T;
}
export async function stripePost<T>(path:string,form:URLSearchParams,key:string):Promise<T>{
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{method:"POST",
    headers:{Authorization:`Bearer ${secret()}`,
      "Content-Type":"application/x-www-form-urlencoded","Idempotency-Key":key},
    body:form.toString(),cache:"no-store"});
  const body=await response.json();
  if(!response.ok)throw new Error(`Stripe request failed: ${body.error?.message??response.status}`);
  return body as T;
}
export type BillingInterval="month"|"year";
export function configuredPrice(interval:BillingInterval){
  const id=interval==="month"?process.env.STRIPE_PRICE_MONTHLY_ID:
    process.env.STRIPE_PRICE_ANNUAL_ID;
  if(!id||!/^price_[a-zA-Z0-9]+$/.test(id))
    throw new Error(`The ${interval} subscription price is not configured`);
  return id;
}
export async function verifiedPrice(interval:BillingInterval){
  const id=configuredPrice(interval);
  const price=await stripeGet<StripePrice>(`prices/${encodeURIComponent(id)}`);
  const expected=interval==="month"?150000:1500000;
  if(!price.active||price.currency!=="usd"||price.unit_amount!==expected||
    price.recurring?.interval!==interval)
    throw new Error("Stripe price does not match the published Solvren plan");
  return id;
}
export function verifyStripeSignature(raw:string,header:string|null,now=Date.now()){
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret||!header)return false;
  const parts=header.split(",").map((entry)=>entry.trim().split("="));
  const timestamp=Number(parts.find((part)=>part[0]==="t")?.[1]);
  if(!Number.isSafeInteger(timestamp)||Math.abs(now/1000-timestamp)>300)return false;
  const expected=createHmac("sha256",secret).update(`${timestamp}.${raw}`).digest();
  return parts.some(([version,candidate])=>{
    if(version!=="v1"||!/^[a-f0-9]{64}$/.test(candidate??""))return false;
    return timingSafeEqual(expected,Buffer.from(candidate,"hex"));
  });
}
export async function subscription(id:string){
  if(!/^sub_[a-zA-Z0-9]+$/.test(id))throw new Error("Invalid subscription ID");
  return stripeGet<StripeSubscription>(`subscriptions/${encodeURIComponent(id)}`,
    new URLSearchParams({"expand[]":"latest_invoice"}));
}
export async function customerSubscriptions(customer:string){
  const query=new URLSearchParams({customer,status:"all",limit:"100"});
  const list=await stripeGet<StripeList<StripeSubscription>>("subscriptions",query);
  if(list.has_more)throw new Error("Too many billing subscriptions to reconcile automatically");
  return list.data;
}
export function subscriptionState(item:StripeSubscription){
  const price=item.items.data[0]?.price;
  const end=item.items.data[0]?.current_period_end??item.current_period_end;
  const invoice=typeof item.latest_invoice==="object"?item.latest_invoice:null;
  const invoiceFailed=invoice?.status==="open"&&invoice.attempted===true&&
    Number(invoice.amount_remaining??0)>0;
  const status=item.status==="active"&&invoiceFailed?"past_due":item.status;
  if(!["active","past_due","canceled","incomplete","unpaid","paused"].includes(status))
    throw new Error(`Unsupported Stripe subscription status: ${status}`);
  if(!price?.id||!price.recurring?.interval||!end)
    throw new Error("Subscription price or billing period is unavailable");
  return {status,priceId:price.id,interval:price.recurring.interval,
    periodEnd:new Date(end*1000).toISOString(),
    cancelAtPeriodEnd:item.cancel_at_period_end,
    invoiceStatus:invoice?.status??null};
}
export function billingCanWrite(row:{status:string;trial_ends_at:string;
  current_period_end:string|null;last_invoice_status:string|null},now=Date.now()){
  if(row.status==="trial")return Date.parse(row.trial_ends_at)>now;
  return row.status==="active"&&row.last_invoice_status!=="open"&&
    (row.current_period_end===null||Date.parse(row.current_period_end)>now);
}
