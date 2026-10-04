import { z } from "zod";
import { jsonError } from "@/lib/api";
import { activeOperator } from "@/lib/operator";
import { adminSupabase } from "@/lib/supabase/admin";

export async function POST(request:Request){
  const operator=await activeOperator();
  if(!operator)return jsonError("Active operator access required.",403);
  const parsed=z.strictObject({title:z.string().trim().min(5).max(160),
    summary:z.string().trim().min(15).max(2000),
    severity:z.enum(["degraded","outage","maintenance"]),published:z.boolean()})
    .safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return jsonError("Enter a title, customer-safe update, and severity.",400);
  const db=adminSupabase();
  const {data,error}=await db.rpc("phase4_create_incident",{
    p_grant:operator.grant.grant_id,p_title:parsed.data.title,
    p_summary:parsed.data.summary,p_severity:parsed.data.severity,
    p_published:parsed.data.published,
  });
  if(error||!data)return jsonError("Incident could not be published.",503);
  return Response.json({id:data},{status:201});
}
