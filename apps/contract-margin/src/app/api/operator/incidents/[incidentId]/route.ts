import { z } from "zod";
import { jsonError } from "@/lib/api";
import { activeOperator } from "@/lib/operator";
import { adminSupabase } from "@/lib/supabase/admin";

export async function PATCH(request:Request,context:{params:Promise<{incidentId:string}>}){
  const {incidentId}=await context.params;
  if(!z.uuid().safeParse(incidentId).success)return jsonError("Incident not found.",404);
  const operator=await activeOperator();
  if(!operator)return jsonError("Active operator access required.",403);
  const parsed=z.strictObject({status:z.enum(["investigating","identified","monitoring","resolved"])})
    .safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return jsonError("Choose a valid incident state.",400);
  const db=adminSupabase();
  const {error}=await db.rpc("phase4_set_incident_status",{
    p_grant:operator.grant.grant_id,p_incident:incidentId,p_status:parsed.data.status});
  if(error)return jsonError("Incident could not be updated.",503);
  return Response.json({updated:true});
}
