import { z } from "zod";
import { jsonError } from "@/lib/api";
import { activeOperator } from "@/lib/operator";
import { adminSupabase } from "@/lib/supabase/admin";

export async function PATCH(request:Request,context:{params:Promise<{ticketId:string}>}){
  const {ticketId}=await context.params;
  if(!z.uuid().safeParse(ticketId).success)return jsonError("Case not found.",404);
  const operator=await activeOperator();
  if(!operator)return jsonError("Active operator access required.",403);
  const parsed=z.strictObject({status:z.enum(["open","in_progress","waiting","resolved"])})
    .safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return jsonError("Choose a valid case status.",400);
  const db=adminSupabase();
  const {error}=await db.rpc("phase4_set_support_status",{
    p_grant:operator.grant.grant_id,p_ticket:ticketId,p_status:parsed.data.status});
  if(error)return jsonError("Case could not be updated.",503);
  return Response.json({updated:true});
}
