import { z } from "zod";
import { jsonError } from "@/lib/api";
import { activeOperator } from "@/lib/operator";
import { adminSupabase } from "@/lib/supabase/admin";

export async function POST(_request:Request,
  context:{params:Promise<{deliveryId:string}>}){
  const {deliveryId}=await context.params;
  if(!z.uuid().safeParse(deliveryId).success)return jsonError("Delivery not found.",404);
  const operator=await activeOperator();
  if(!operator)return jsonError("Active operator access required.",403);
  const {error}=await adminSupabase().rpc("phase4_retry_lifecycle",{
    p_grant:operator.grant.grant_id,p_delivery:deliveryId});
  if(error)return jsonError("The failed delivery could not be queued again.",503);
  return Response.json({queued:true});
}
