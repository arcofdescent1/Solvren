import { createHmac,randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { visitorHash } from "@/lib/conversion";

export async function POST(request:Request){
  const salt=process.env.ANALYTICS_HASH_SECRET??process.env.CRON_SECRET;
  if(!salt||salt.length<32)return Response.json({error:"Analytics unavailable"},{status:503});
  let hash=visitorHash(request.headers.get("cookie"));
  const id=hash?null:randomUUID();
  if(id)hash=createHmac("sha256",salt).update(id).digest("hex");
  if(!hash)return Response.json({error:"Analytics unavailable"},{status:503});
  const key=`visit:${new Date().toISOString().slice(0,10)}:${hash}`;
  const {error}=await adminSupabase().rpc("phase4_record_conversion",{
    p_key:key,p_name:"visit",p_org:null,p_visitor:hash,
  });
  if(error)return Response.json({error:"Analytics unavailable"},{status:503});
  const response=NextResponse.json({recorded:true});
  if(id)response.cookies.set("solvren_visitor",id,{httpOnly:true,sameSite:"lax",
    secure:process.env.NODE_ENV==="production",path:"/",maxAge:30*24*60*60});
  return response;
}
