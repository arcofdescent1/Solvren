import { randomUUID } from "node:crypto";
import { z } from "zod";
import { jsonError,requestOwner } from "@/lib/api";
import { appOrigin,stripePost } from "@/lib/billing";
import { adminSupabase } from "@/lib/supabase/admin";

export async function POST(_request:Request,context:{params:Promise<{orgId:string}>}){
  const {orgId}=await context.params;
  if(!z.uuid().safeParse(orgId).success)return jsonError("Organization not found.",404);
  const owner=await requestOwner(orgId);
  if(!owner)return jsonError("Owner access with MFA required.",403);
  const db=adminSupabase();
  const {data,error}=await db.from("organization_billing")
    .select("stripe_customer_id").eq("org_id",orgId).single();
  if(error||!data?.stripe_customer_id)return jsonError("No billing customer is linked yet.",404);
  try{
    const session=await stripePost<{url:string}>("billing_portal/sessions",
      new URLSearchParams({customer:data.stripe_customer_id,
        return_url:`${appOrigin()}/o/${orgId}/billing`}),
      `solvren-portal-${orgId}-${randomUUID()}`);
    const url=new URL(session.url);
    if(url.protocol!=="https:"||url.hostname!=="billing.stripe.com")
      throw new Error("Stripe did not return a valid portal link");
    const {error:auditError}=await db.rpc("phase4_record_audit",{
      p_org:orgId,p_actor:owner.user.id,p_type:"billing_portal",
      p_entity:data.stripe_customer_id,p_details:{},
    });
    if(auditError)throw new Error("Could not audit the billing portal visit");
    return Response.json({url:session.url});
  }catch(error){return jsonError(error instanceof Error?error.message:"Billing portal unavailable.",503);}
}
