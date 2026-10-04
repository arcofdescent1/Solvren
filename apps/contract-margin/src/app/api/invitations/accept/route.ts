import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requestUser } from "@/lib/api";

export async function POST(request: Request) {
  const session = await requestUser();
  if (!session) return jsonError("Sign in and verify the invited email first.", 401);
  const parsed = z.strictObject({ token: z.string().regex(/^[0-9a-f]{64}$/) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid invitation.", 400);
  const { data, error } = await session.supabase.rpc("accept_organization_invite", { p_token: parsed.data.token });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ organizationId: data });
}
