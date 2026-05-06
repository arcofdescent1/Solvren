/**
 * POST /api/internal/support-access/break-glass — initiate org break-glass (pending approvals).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canInitiateBreakGlass } from "@/lib/server/employee/phase4EmployeeRoleMap";

export const runtime = "nodejs";

const Body = z.object({
  orgId: z.string().uuid(),
  reason: z.string().min(3).max(2000),
  severity: z.enum(["high", "critical"]),
  durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});

export async function POST(req: Request) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const { admin, user, phase4Profile } = gate.ctx;
  if (!canInitiateBreakGlass(phase4Profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data: open } = await admin
    .from("break_glass_access_events")
    .select("id")
    .eq("org_id", body.orgId)
    .is("ended_at", null)
    .maybeSingle();

  if (open) {
    return NextResponse.json({ error: "An open break-glass event already exists for this organization" }, { status: 409 });
  }

  const { data: inserted, error } = await admin
    .from("break_glass_access_events")
    .insert({
      org_id: body.orgId,
      employee_user_id: user.id,
      initiated_by_user_id: user.id,
      reason: body.reason.trim().slice(0, 500),
      severity: body.severity,
      duration_minutes: body.durationMinutes,
      activated_at: null,
      expires_at: null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[break-glass/init]", error.message);
    return NextResponse.json({ error: "Failed to create break-glass event" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    eventId: (inserted as { id: string }).id,
    message: "Pending approval; use POST /api/internal/support-access/break-glass/[eventId]/approve",
  });
}
