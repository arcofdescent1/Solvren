import { createHmac } from "node:crypto";
import { z } from "zod";
import { jsonError,requestUser } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/admin";
import { boundedJson } from "@/lib/bounded-json";

const schema=z.strictObject({email:z.email().max(320),
  category:z.enum(["product","integration","billing","security","deletion"]),
  subject:z.string().trim().min(5).max(160),
  description:z.string().trim().min(15).max(4000),
  orgId:z.uuid().nullable(),website:z.string().max(200)});
export async function POST(request:Request){
  const parsed=schema.safeParse(await boundedJson(request,15_000).catch(()=>null));
  if(!parsed.success)return jsonError("Enter a valid email, category, subject, and message.",400);
  if(parsed.data.website)return Response.json({accepted:true});
  const salt=process.env.SUPPORT_RATE_SECRET??process.env.CRON_SECRET;
  if(!salt||salt.length<32)return jsonError("Support service is not configured.",503);
  const forwarded=request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()??"";
  const fingerprint=createHmac("sha256",salt).update(forwarded||parsed.data.email.toLowerCase())
    .digest("hex");
  const db=adminSupabase();
  const {data:allowed,error:rateError}=await db.rpc("phase4_allow_support_request",
    {p_fingerprint:`\\x${fingerprint}`});
  if(rateError)return jsonError("Support request could not be accepted.",503);
  if(!allowed)return jsonError("Too many requests. Please try again in an hour.",429);
  const session=await requestUser();
  let orgId:string|null=null;
  if(session&&parsed.data.orgId){
    const {data}=await session.supabase.from("organization_members").select("org_id")
      .eq("org_id",parsed.data.orgId).eq("user_id",session.user.id).maybeSingle();
    if(data)orgId=data.org_id;
  }
  const urgent=parsed.data.category==="billing"||parsed.data.category==="security";
  const expected=new Date(Date.now()+(urgent?24:48)*60*60_000).toISOString();
  const {data,error}=await db.from("support_tickets").insert({
    org_id:orgId,requester_user_id:session?.user.id??null,
    email:parsed.data.email.toLowerCase(),category:parsed.data.category,
    subject:parsed.data.subject,description:parsed.data.description,
    expected_response_at:expected,
  }).select("case_number").single();
  if(error||!data)return jsonError("Support request could not be saved.",503);
  return Response.json({caseId:`SV-${String(data.case_number).padStart(6,"0")}`,
    expectedResponseAt:expected},{status:201});
}
