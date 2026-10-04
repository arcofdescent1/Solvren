import { createHmac } from "node:crypto";

export function visitorHash(cookie:string|null){
  const id=cookie?.split(";").map((part)=>part.trim()).find((part)=>
    part.startsWith("solvren_visitor="))?.split("=")[1];
  if(!id||!/^[0-9a-f-]{36}$/i.test(id))return null;
  const salt=process.env.ANALYTICS_HASH_SECRET??process.env.CRON_SECRET;
  if(!salt||salt.length<32)throw new Error("Anonymous analytics is not configured");
  return createHmac("sha256",salt).update(id).digest("hex");
}
