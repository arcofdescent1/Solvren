import { z } from "zod";
import { jsonError,verifyRecentTotp } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/admin";
import { activeOperator,operatorIdentity } from "@/lib/operator";

export async function POST(request:Request){
  const session=await operatorIdentity();
  if(!session)return jsonError("Operator authorization and MFA required.",403);
  const parsed=z.strictObject({reason:z.string().trim().min(15).max(500),
    code:z.string().regex(/^\d{6}$/)}).safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return jsonError("Give a specific reason and current authenticator code.",400);
  if(!await verifyRecentTotp(session.supabase,parsed.data.code))
    return jsonError("Authenticator code was not accepted.",403);
  const {data,error}=await adminSupabase().rpc("phase4_start_operator_access",{
    p_user:session.user.id,p_reason:parsed.data.reason});
  if(error)return jsonError("Operator access could not be opened.",503);
  return Response.json({grantId:data,expiresInMinutes:30});
}
export async function DELETE(){
  const session=await activeOperator();
  if(!session)return jsonError("Active operator access required.",403);
  const {error}=await adminSupabase().rpc("phase4_end_operator_access",
    {p_grant:session.grant.grant_id});
  if(error)return jsonError("Operator access could not be closed.",503);
  return Response.json({closed:true});
}
