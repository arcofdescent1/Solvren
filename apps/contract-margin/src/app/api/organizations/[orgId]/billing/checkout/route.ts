import { z } from "zod";
import { jsonError,requestOwner } from "@/lib/api";
import { appOrigin,customerSubscriptions,stripePost,verifiedPrice } from "@/lib/billing";
import { adminSupabase } from "@/lib/supabase/admin";

const schema=z.strictObject({interval:z.enum(["month","year"])});
type StripeCustomer={id:string};
type Checkout={id:string;url:string|null};
export async function POST(request:Request,context:{params:Promise<{orgId:string}>}){
  const {orgId}=await context.params;
  if(!z.uuid().safeParse(orgId).success)return jsonError("Organization not found.",404);
  const session=await requestOwner(orgId);
  if(!session)return jsonError("Owner access with MFA required.",403);
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return jsonError("Choose monthly or annual billing.",400);
  const db=adminSupabase();
  const {data:billing,error}=await db.from("organization_billing")
    .select("stripe_customer_id,stripe_subscription_id,status")
    .eq("org_id",orgId).single();
  if(error||!billing)return jsonError("Billing record unavailable.",503);
  if(billing.status==="active"||billing.status==="past_due")
    return jsonError("Manage the existing subscription in the billing portal.",409);
  try{
    const price=await verifiedPrice(parsed.data.interval);
    let customer=billing.stripe_customer_id;
    if(!customer){
      const form=new URLSearchParams({"metadata[solvren_org_id]":orgId});
      if(session.user.email)form.set("email",session.user.email);
      const created=await stripePost<StripeCustomer>("customers",form,`solvren-customer-${orgId}`);
      const {error:saveError}=await db.from("organization_billing")
        .update({stripe_customer_id:created.id}).eq("org_id",orgId)
        .is("stripe_customer_id",null);
      if(saveError)throw new Error("Could not link the billing customer");
      const {data:current,error:readError}=await db.from("organization_billing")
        .select("stripe_customer_id").eq("org_id",orgId).single();
      if(readError||!current?.stripe_customer_id)throw new Error("Could not verify the billing customer");
      customer=current.stripe_customer_id;
    }
    const existing=await customerSubscriptions(customer);
    if(existing.some((item)=>item.status!=="canceled"))
      return jsonError("A subscription already exists. Open billing or contact support before starting another checkout.",409);
    const {data:claim,error:claimError}=await db.rpc("phase4_claim_checkout",{
      p_org:orgId,p_interval:parsed.data.interval});
    if(claimError||!claim?.id||!claim.expiresAt)
      throw new Error(claimError?.message??"Checkout could not be reserved");
    if(claim.url)return Response.json({url:claim.url});
    const origin=appOrigin();
    const form=new URLSearchParams({mode:"subscription",customer,
      client_reference_id:orgId,"line_items[0][price]":price,
      "line_items[0][quantity]":"1","metadata[solvren_org_id]":orgId,
      "subscription_data[metadata][solvren_org_id]":orgId,
      expires_at:String(claim.expiresAt),
      success_url:`${origin}/o/${orgId}/billing?checkout=success`,
      cancel_url:`${origin}/o/${orgId}/billing?checkout=canceled`});
    const checkout=await stripePost<Checkout>("checkout/sessions",form,
      `solvren-checkout-${claim.id}`);
    if(!checkout.url||new URL(checkout.url).hostname!=="checkout.stripe.com")
      throw new Error("Stripe did not return a valid checkout link");
    const {error:auditError}=await db.rpc("phase4_record_audit",{
      p_org:orgId,p_actor:session.user.id,p_type:"billing_checkout",
      p_entity:checkout.id,p_details:{interval:parsed.data.interval},
    });
    if(auditError)throw new Error("Could not audit the billing checkout");
    const {error:saveError}=await db.rpc("phase4_save_checkout",{
      p_org:orgId,p_claim:claim.id,p_session:checkout.id,p_url:checkout.url});
    if(saveError)throw new Error("Could not save the billing checkout");
    return Response.json({url:checkout.url});
  }catch(error){return jsonError(error instanceof Error?error.message:"Checkout unavailable.",503);}
}
