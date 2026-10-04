import { adminSupabase } from "@/lib/supabase/admin";

export async function recordLogin(userId:string){
  const db=adminSupabase();
  for(let start=0;;start+=1000){
    const {data,error}=await db.from("organization_members")
      .select("org_id").eq("user_id",userId).range(start,start+999);
    if(error)throw new Error("Could not read login audit membership");
    for(const item of data??[]){
      const {error:writeError}=await db.rpc("phase4_record_audit",{
        p_org:item.org_id,p_actor:userId,p_type:"login",p_entity:userId,
        p_details:{method:"authenticated_session"},
      });
      if(writeError)throw new Error("Could not record login audit event");
    }
    if((data?.length??0)<1000)break;
  }
}
