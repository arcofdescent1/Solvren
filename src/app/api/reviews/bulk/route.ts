import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

type Action = "RETRY_FAILED" | "MARK_DELIVERED" | "NUDGE_APPROVERS";

type Body = {
  action: Action;
  changeIds?: string[];
  outboxIds?: string[];
  channel?: "IN_APP" | "SLACK" | "EMAIL";
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action)
    return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const { data: memberships, error: memErr } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id);

  if (memErr)
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  const orgIds = (memberships ?? []).map((m) => m.org_id);
  if (!orgIds.length)
    return NextResponse.json({ error: "No org" }, { status: 403 });

  const changeIds = uniq((body.changeIds ?? []).filter(Boolean));
  const outboxIds = uniq((body.outboxIds ?? []).filter(Boolean));

  async function loadOutboxMeta(ids: string[]) {
    const { data, error } = await supabase
      .from("notification_outbox")
      .select("id, org_id, change_event_id, channel, status")
      .in("id", ids);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      org_id: string;
      change_event_id: string;
      channel?: string;
      status?: string;
    }>;
  }

  async function assertOutboxIdsInOrg(ids: string[]) {
    if (!ids.length) return;
    const rows = await loadOutboxMeta(ids);
    const changeEventIds = uniq(
      rows.map((r) => r.change_event_id).filter(Boolean)
    );
    if (!changeEventIds.length) throw new Error("Forbidden outbox id");

    const { data: changes, error: ceErr } = await supabase
      .from("change_events")
      .select("id, org_id")
      .in("id", changeEventIds);
    if (ceErr) throw new Error(ceErr.message);

    const ok = (changes ?? []).every((c) => orgIds.includes(c.org_id));
    if (!ok) throw new Error("Forbidden outbox id");
  }

  async function resolveOutboxIdsByChangeIds(statuses: string[]) {
    if (!changeIds.length) return [];
    const { data, error } = await supabase
      .from("notification_outbox")
      .select("id, change_event_id")
      .in("change_event_id", changeIds)
      .in("status", statuses);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.id as string);
  }

  async function assertChangeIdsInOrg() {
    if (!changeIds.length) return;
    const { data, error } = await supabase
      .from("change_events")
      .select("id, org_id")
      .in("id", changeIds);
    if (error) throw new Error(error.message);
    const ok = (data ?? []).every((c) => orgIds.includes(c.org_id));
    if (!ok) throw new Error("Forbidden change id");
  }

  try {
    if (body.action === "RETRY_FAILED") {
      await assertChangeIdsInOrg();
      const ids =
        outboxIds.length > 0
          ? outboxIds
          : await resolveOutboxIdsByChangeIds(["FAILED"]);
      if (!ids.length)
        return NextResponse.json({ ok: true, affected: 0 });
      await assertOutboxIdsInOrg(ids);
      const { error } = await supabase
        .from("notification_outbox")
        .update({
          status: "PENDING",
          attempt_count: 0,
          last_error: null,
          available_at: new Date().toISOString(),
          sent_at: null,
        })
        .in("id", ids);
      if (error) throw new Error(error.message);
      const meta = await loadOutboxMeta(ids);
      const byChange = new Map<
        string,
        { org_id: string; outbox_ids: string[] }
      >();
      for (const r of meta) {
        const cid = String(r.change_event_id ?? "");
        if (!cid) continue;
        const cur = byChange.get(cid) ?? { org_id: String(r.org_id), outbox_ids: [] };
        cur.outbox_ids.push(String(r.id));
        byChange.set(cid, cur);
      }
      for (const [, info] of byChange.entries()) {
        await auditLog(supabase, {
          orgId: info.org_id,
          actorId: userRes.user.id,
          action: "delivery_retried",
          entityType: "outbox",
          entityId: null,
          metadata: {
            affected: info.outbox_ids.length,
            outbox_ids: info.outbox_ids.slice(0, 50),
          },
        });
      }
      return NextResponse.json({ ok: true, affected: ids.length });
    }

    if (body.action === "MARK_DELIVERED") {
      await assertChangeIdsInOrg();
      const ids =
        outboxIds.length > 0
          ? outboxIds
          : await resolveOutboxIdsByChangeIds([
              "PENDING",
              "FAILED",
              "PROCESSING",
            ]);
      if (!ids.length)
        return NextResponse.json({ ok: true, affected: 0 });
      await assertOutboxIdsInOrg(ids);
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("notification_outbox")
        .update({
          status: "SENT",
          sent_at: nowIso,
          last_error: null,
          attempt_count: 0,
        })
        .in("id", ids);
      if (error) throw new Error(error.message);
      const meta = await loadOutboxMeta(ids);
      const byChange = new Map<
        string,
        { org_id: string; outbox_ids: string[] }
      >();
      for (const r of meta) {
        const cid = String(r.change_event_id ?? "");
        if (!cid) continue;
        const cur = byChange.get(cid) ?? {
          org_id: String(r.org_id),
          outbox_ids: [],
        };
        cur.outbox_ids.push(String(r.id));
        byChange.set(cid, cur);
      }
      for (const [, info] of byChange.entries()) {
        await auditLog(supabase, {
          orgId: info.org_id,
          actorId: userRes.user.id,
          action: "delivery_marked_delivered",
          entityType: "outbox",
          entityId: null,
          metadata: {
            affected: info.outbox_ids.length,
            outbox_ids: info.outbox_ids.slice(0, 50),
          },
        });
      }
      return NextResponse.json({ ok: true, affected: ids.length });
    }

    if (body.action === "NUDGE_APPROVERS") {
      await assertChangeIdsInOrg();
      if (!changeIds.length)
        return NextResponse.json(
          { error: "Missing changeIds" },
          { status: 400 }
        );
      const channel = body.channel ?? "IN_APP";
      const nowIso = new Date().toISOString();
      const { data: changes, error: ceErr } = await supabase
        .from("change_events")
        .select("id, org_id")
        .in("id", changeIds);
      if (ceErr) throw new Error(ceErr.message);

      const inserts = [];
      for (const c of changes ?? []) {
        const dedupeKey = `${c.org_id}:${c.id}:${channel}:approval_nudge`;
        inserts.push({
          org_id: c.org_id,
          change_event_id: c.id,
          channel,
          template_key: "approval_nudge",
          payload: { changeEventId: c.id, kind: "approval_nudge" },
          dedupe_key: dedupeKey,
          status: "PENDING",
          attempt_count: 0,
          last_error: null,
          available_at: nowIso,
        });
      }
      if (inserts.length) {
        const { error: insErr } = await supabase
          .from("notification_outbox")
          .insert(inserts);
        if (insErr)
          return NextResponse.json({
            ok: true,
            warning: insErr.message,
            attempted: inserts.length,
          });
        const orgIdForNudge = (changes ?? [])[0]?.org_id ?? orgIds[0];
        await auditLog(supabase, {
          orgId: orgIdForNudge,
          actorId: userRes.user.id,
          action: "approval_nudged",
          entityType: "change",
          entityId: null,
          metadata: { attempted: inserts.length, channel },
        });
      }
      return NextResponse.json({ ok: true, attempted: inserts.length });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Bulk action failed",
      },
      { status: 500 }
    );
  }
}
