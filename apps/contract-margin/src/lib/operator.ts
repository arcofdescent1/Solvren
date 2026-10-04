import { requestUser } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/admin";

export function operatorAllowed(userId:string){
  return (process.env.OPERATOR_USER_IDS??"").split(",").map((value)=>value.trim())
    .filter(Boolean).includes(userId);
}
export async function operatorIdentity(){
  const session=await requestUser();
  if(!session||!operatorAllowed(session.user.id))return null;
  const {data}=await session.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(data?.currentLevel!=="aal2")return null;
  return session;
}
export async function operatorGrant(userId:string){
  const {data,error}=await adminSupabase().rpc("phase4_operator_grant",{p_user:userId});
  if(error)throw new Error("Operator grant lookup failed");
  return (data?.[0]??null) as {grant_id:string;expires_at:string;reason:string}|null;
}
export async function activeOperator(){
  const session=await operatorIdentity();
  if(!session)return null;
  const grant=await operatorGrant(session.user.id);
  if(!grant)return null;
  return {...session,grant};
}
