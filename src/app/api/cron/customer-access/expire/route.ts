/**
 * POST /api/cron/customer-access/expire — Phase 4 time-boxed access maintenance (~15m).
 */
import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { expireCustomerAccessGrants } from "@/modules/access/jobs/expire-customer-access-grants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const admin = createPrivilegedClient("cron:expire-customer-access");
  const res = await expireCustomerAccessGrants(admin);
  return NextResponse.json({ ok: true, ...res });
}
