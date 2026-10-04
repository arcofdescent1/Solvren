import { z } from "zod";
import { jsonError,requestOrgRole } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/admin";

export async function POST(_request:Request,context:{params:Promise<{orgId:string}>}){
  const {orgId}=await context.params;
  if(!z.uuid().safeParse(orgId).success)return jsonError("Organization not found.",404);
  const session=await requestOrgRole(orgId,["owner","finance"]);
  if(!session)return jsonError("Finance access with MFA required.",403);
  const db=adminSupabase();
  const {data,error}=await db.rpc("phase3_retry_failed_deliveries",{p_org:orgId});
  if(error)return jsonError("Could not retry failed deliveries.",503);
  return Response.json({retried:data});
}
