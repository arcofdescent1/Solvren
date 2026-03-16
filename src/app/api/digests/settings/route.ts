import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

type DigestSettings = {
  org_id: string;
  enabled: boolean;
  slack_enabled: boolean;
  email_enabled: boolean;
  slack_channel_id: string | null;
  email_recipients: string[] | null;
  timezone: string | null;
  day_of_week: number | null; // 1=Mon
  hour_local: number | null; // 0-23
};

function normalizeEmails(raw: string[] | null | undefined) {
  if (!raw) return null;
  const cleaned = raw
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  const unique = Array.from(new Set(cleaned));
  return unique.length ? unique : null;
}

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId)
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("digest_settings")
    .select(
      "org_id, enabled, slack_enabled, email_enabled, slack_channel_id, email_recipients, timezone, day_of_week, hour_local"
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    settings:
      data ?? {
        org_id: orgId,
        enabled: false,
        slack_enabled: true,
        email_enabled: true,
        slack_channel_id: null,
        email_recipients: null,
        timezone: "UTC",
        day_of_week: 1,
        hour_local: 9,
      },
  });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as DigestSettings | null;
  if (!body?.org_id)
    return NextResponse.json({ error: "Missing org_id" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", body.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole(member.role ?? null))) {
    return NextResponse.json({ error: "Owner/Admin required" }, { status: 403 });
  }

  const emails = normalizeEmails(body.email_recipients);
  const slackChannel =
    body.slack_channel_id?.trim() ? body.slack_channel_id.trim() : null;

  const day = body.day_of_week == null ? 1 : Number(body.day_of_week);
  const hour = body.hour_local == null ? 9 : Number(body.hour_local);

  // 1=Mon .. 7=Sun
  if (day < 1 || day > 7)
    return NextResponse.json(
      { error: "day_of_week must be 1 (Mon) to 7 (Sun)" },
      { status: 400 }
    );
  if (hour < 0 || hour > 23)
    return NextResponse.json(
      { error: "hour_local must be 0-23" },
      { status: 400 }
    );

  const { error: upsertError } = await supabase
    .from("digest_settings")
    .upsert(
      {
        org_id: body.org_id,
        enabled: Boolean(body.enabled),
        slack_enabled: Boolean(body.slack_enabled),
        email_enabled: Boolean(body.email_enabled),
        slack_channel_id: slackChannel,
        email_recipients: emails,
        timezone: body.timezone ?? "UTC",
        day_of_week: day,
        hour_local: hour,
      },
      { onConflict: "org_id" }
    );

  if (upsertError)
    return NextResponse.json(
      { error: upsertError.message },
      { status: 500 }
    );

  return NextResponse.json({ ok: true });
}
