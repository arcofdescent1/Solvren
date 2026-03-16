/**
 * IES: Slash command request URL
 * POST /api/integrations/slack/commands
 * Handles /rg [approvals|status RG-xxx|help]
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySlackRequest } from "@/services/slack/verifySlack";
import { env } from "@/lib/env";

function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${env.appUrl}${path}`;
}

/** Parse RG-xxx or UUID to find change. Accept: RG-12345678, RG-abc12345, or full UUID */
function parseChangeRef(text: string): string | null {
  const t = text?.trim() ?? "";
  if (!t) return null;
  const rgMatch = t.match(/^RG-([a-fA-F0-9]{8})$/);
  if (rgMatch) {
    const prefix = rgMatch[1].toLowerCase();
    return prefix; // caller will use like id::text ilike prefix || '%'
  }
  const uuidMatch = t.match(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  );
  if (uuidMatch) return t;
  return null;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signingSecret = env.slackSigningSecret;
  if (!signingSecret)
    return NextResponse.json({ error: "Slack not configured" }, { status: 503 });

  if (
    !verifySlackRequest({
      rawBody,
      timestamp: req.headers.get("x-slack-request-timestamp"),
      signature: req.headers.get("x-slack-signature"),
      signingSecret,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const form = new URLSearchParams(rawBody);
  const command = form.get("command") ?? "";
  const text = (form.get("text") ?? "").trim();
  const slackUserId = form.get("user_id");
  const teamId = form.get("team_id");
  if (command !== "/rg" || !teamId || !slackUserId) {
    return NextResponse.json(
      { response_type: "ephemeral", text: "Unknown command or missing context." },
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const admin = createAdminClient();

  const { data: install } = await admin
    .from("slack_installations")
    .select("org_id, bot_token")
    .eq("team_id", teamId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!install?.org_id || !install?.bot_token) {
    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: "Slack is not connected for this workspace. Ask your org admin to connect Slack in Solvren settings.",
      },
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const orgId = install.org_id as string;

  const { data: mapped } = await admin
    .from("slack_user_map")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("slack_user_id", slackUserId)
    .maybeSingle();

  const userId = mapped?.user_id ?? null;

  // ——— /rg help ———
  const sub = text.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (sub === "help" || !text) {
    const lines = [
      "*Solvren (/rg) commands*",
      "`/rg approvals` – List your pending approvals",
      "`/rg status RG-<id>` – Show status for a change (e.g. RG-12345678)",
      "`/rg help` – Show this help",
    ];
    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: lines.join("\n"),
      },
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ——— /rg approvals ———
  if (sub === "approvals") {
    if (!userId) {
      return NextResponse.json(
        {
          response_type: "ephemeral",
          text: "Your Slack user isn't linked to Solvren. Link Slack in org settings to use this command.",
        },
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: approvals } = await admin
      .from("approvals")
      .select("id, change_event_id, approval_area, domain")
      .eq("org_id", orgId)
      .eq("approver_user_id", userId)
      .eq("decision", "PENDING")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!approvals?.length) {
      return NextResponse.json(
        {
          response_type: "ephemeral",
          text: "You have no pending approvals.",
        },
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const changeIds = [...new Set(approvals.map((a) => a.change_event_id))];
    const { data: changes } = await admin
      .from("change_events")
      .select("id, title, domain")
      .in("id", changeIds);
    const { data: assessments } = await admin
      .from("impact_assessments")
      .select("change_event_id, risk_bucket")
      .in("change_event_id", changeIds)
      .order("created_at", { ascending: false });

    const changeMap = new Map((changes ?? []).map((c) => [c.id, c]));
    const bucketByChange = new Map<string, string | null>();
    for (const a of assessments ?? []) {
      const cid = a.change_event_id as string;
      if (!bucketByChange.has(cid)) bucketByChange.set(cid, a.risk_bucket ?? null);
    }

    const blocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "Pending approvals", emoji: true },
      },
    ];

    for (const a of approvals) {
      const c = changeMap.get(a.change_event_id as string);
      const shortId = String(a.change_event_id).slice(0, 8);
      const risk = bucketByChange.get(a.change_event_id as string) ?? "—";
      const title = (c?.title as string) ?? "Untitled";
      const changeUrl = absoluteUrl(`/changes/${a.change_event_id}`);
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*RG-${shortId}* · ${title}\nRisk: ${risk}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Open" },
          url: changeUrl,
          action_id: "slack_open_change",
        },
      });
    }

    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: `You have ${approvals.length} pending approval(s).`,
        blocks,
      },
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ——— /rg status RG-xxx ———
  if (sub === "status") {
    const rest = text.slice(sub.length).trim();
    const ref = parseChangeRef(rest);
    if (!ref) {
      return NextResponse.json(
        {
          response_type: "ephemeral",
          text: "Usage: `/rg status RG-<id>` (e.g. RG-12345678) or full change UUID.",
        },
        { headers: { "Content-Type": "application/json" } }
      );
    }

    type ChangeRow = { id: string; title: string | null; domain: string | null; status: string | null };
    let changeRow: ChangeRow | null = null;
    if (ref.length === 36) {
      const { data } = await admin
        .from("change_events")
        .select("id, title, domain, status")
        .eq("id", ref)
        .eq("org_id", orgId)
        .maybeSingle();
      changeRow = data as ChangeRow | null;
    } else {
      const { data } = await admin.rpc("get_change_by_rg_ref", {
        p_org_id: orgId,
        p_ref: ref.toLowerCase(),
      });
      const row = Array.isArray(data) ? data[0] : (data as ChangeRow | null);
      changeRow = row && typeof row === "object" && "id" in row ? (row as ChangeRow) : null;
    }

    if (!changeRow) {
      return NextResponse.json(
        {
          response_type: "ephemeral",
          text: `Change not found: ${rest}`,
        },
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const shortId = String(changeRow.id).slice(0, 8);
    const { data: approvals } = await admin
      .from("approvals")
      .select("decision, approval_area")
      .eq("change_event_id", changeRow.id);
    const pending = (approvals ?? []).filter((a) => a.decision === "PENDING").length;
    const total = (approvals ?? []).length;
    const { data: assessment } = await admin
      .from("impact_assessments")
      .select("risk_bucket")
      .eq("change_event_id", changeRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const risk = (assessment as { risk_bucket?: string })?.risk_bucket ?? "—";
    const changeUrl = absoluteUrl(`/changes/${changeRow.id}`);

    const textResp = [
      `*RG-${shortId}* · ${(changeRow.title as string) ?? "Untitled"}`,
      `Status: ${(changeRow.status as string) ?? "—"} · Risk: ${risk}`,
      `Approvals: ${total - pending}/${total} completed`,
      `<${changeUrl}|Open change>`,
    ].join("\n");

    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: textResp,
      },
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return NextResponse.json(
    {
      response_type: "ephemeral",
      text: "Unknown subcommand. Use `/rg help` for options.",
    },
    { headers: { "Content-Type": "application/json" } }
  );
}
