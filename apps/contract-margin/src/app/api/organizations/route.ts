import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requestUser } from "@/lib/api";

const schema = z.strictObject({ name: z.string().trim().min(2).max(80) });

export async function POST(request: Request) {
  const session = await requestUser();
  if (!session) return jsonError("Sign in with a verified work email.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter an organization name of 2–80 characters.", 400);
  const { data, error } = await session.supabase.rpc("create_organization", { p_name: parsed.data.name });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ organizationId: data }, { status: 201 });
}
