import { requestUser } from "@/lib/api";
import { recordLogin } from "@/lib/audit";

export async function POST(){
  const session=await requestUser();
  if(!session)return Response.json({error:"Sign-in required"},{status:401});
  const signedIn=Date.parse(session.user.last_sign_in_at??"");
  if(!Number.isFinite(signedIn)||Date.now()-signedIn>2*60_000)
    return Response.json({error:"Recent sign-in required"},{status:403});
  try{await recordLogin(session.user.id);return Response.json({recorded:true});}
  catch{return Response.json({error:"Audit service unavailable"},{status:503});}
}
