/**
 * POST /api/internal/support-access/request — employee requests customer-approved access.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import {
  notifyOrgSupportAccessEvent,
  sanitizeSupportAccessReason,
} from "@/lib/server/access/support-access-notifications";

export const runtime = "nodejs";

const Body = z.object({
  orgId: z.string().uuid(),
  accessLevel: z.enum(["masked", "sensitive"]),
  reason: z.string().min(3).max(2000),
  durationHours: z.union([z.literal(1), z.literal(4), z.literal(24), z.literal(72)]),
});

export async function POST(req: Request) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { admin, user, phase4Profile } = gate.ctx;
  const safeReason = sanitizeSupportAccessReason(body.reason);

  const { data: existing } = await admin
    .from("customer_access_grants")
    .select("id")
    .eq("org_id", body.orgId)
    .eq("employee_user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A pending request already exists for this organization" }, { status: 409 });
  }

  const { data: inserted, error } = await admin
    .from("customer_access_grants")
    .insert({
      org_id: body.orgId,
      employee_user_id: user.id,
      requested_by_user_id: user.id,
      access_level: body.accessLevel,
      reason: safeReason,
      duration_hours: body.durationHours,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[support-access/request]", error.message);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }

  await notifyOrgSupportAccessEvent(admin, body.orgId, {
    title: "Support access requested",
    body: `A Solvren employee requested ${body.accessLevel} support access. Reason: ${safeReason}`,
    dedupeKey: `support_access:request:${(inserted as { id: string }).id}:in_app`,
  });

  return NextResponse.json({
    ok: true,
    grantId: (inserted as { id: string }).id,
    effectiveCeiling: phase4Profile.role === "SUPPORT" && body.accessLevel === "sensitive" ? "masked" : body.accessLevel,
  });
}
