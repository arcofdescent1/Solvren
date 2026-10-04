import { adminSupabase } from "@/lib/supabase/admin";

export async function GET(){
  try{
    const {error}=await adminSupabase().from("status_incidents").select("id").limit(1);
    if(error)throw error;
    return Response.json({status:"ok",checkedAt:new Date().toISOString()},
      {headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({status:"degraded",checkedAt:new Date().toISOString()},
    {status:503,headers:{"Cache-Control":"no-store"}});}
}
