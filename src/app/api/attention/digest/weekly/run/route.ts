import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { enqueueAttentionDigests } from "@/lib/attention/enqueueAttentionDigests";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;
  const admin = createAdminClient();
  const result = await enqueueAttentionDigests(admin, "WEEKLY");
  return NextResponse.json({ ok: true, ...result });
}
