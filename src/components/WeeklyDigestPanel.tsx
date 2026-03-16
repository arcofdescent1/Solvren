"use client";;
import { Button, Input, NativeSelect, Textarea } from "@/ui";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DigestSettings = {
  org_id: string;
  enabled: boolean;
  slack_enabled: boolean;
  email_enabled: boolean;
  slack_channel_id: string | null;
  email_recipients: string[] | null;
  timezone: string | null;
  day_of_week: number | null;
  hour_local: number | null;
};

function parseEmails(input: string) {
  const parts = input
    .split(/[\n,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const uniq = Array.from(new Set(parts.map((s) => s.toLowerCase())));
  return uniq.length ? uniq : null;
}

const DOW = [
  { v: 1, label: "Monday" },
  { v: 2, label: "Tuesday" },
  { v: 3, label: "Wednesday" },
  { v: 4, label: "Thursday" },
  { v: 5, label: "Friday" },
  { v: 6, label: "Saturday" },
  { v: 7, label: "Sunday" },
];

export default function WeeklyDigestPanel({
  orgId,
  isAdmin,
}: {
  orgId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [enabled, setEnabled] = useState(false);
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [slackChannelId, setSlackChannelId] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [hourLocal, setHourLocal] = useState<number>(9);
  const [timezone, setTimezone] = useState<string>("UTC");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const emailsParsed = useMemo(() => parseEmails(emailsText), [emailsText]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMsg(null);

      const resp = await fetch(
        `/api/digests/settings?orgId=${encodeURIComponent(orgId)}`
      );
      const json = await resp.json().catch(() => ({}));

      if (cancelled) return;

      if (!resp.ok) {
        setLoading(false);
        setMsg(json?.error ?? "Failed to load digest settings.");
        return;
      }

      const s: DigestSettings = json.settings;

      setEnabled(Boolean(s.enabled));
      setSlackEnabled(Boolean(s.slack_enabled));
      setEmailEnabled(Boolean(s.email_enabled));
      setSlackChannelId(s.slack_channel_id ?? "");
      setEmailsText((s.email_recipients ?? []).join("\n"));
      setDayOfWeek(Number(s.day_of_week ?? 1));
      setHourLocal(Number(s.hour_local ?? 9));
      setTimezone(String(s.timezone ?? "UTC"));

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  async function save() {
    if (!isAdmin) {
      setMsg("Admin required to change digest settings.");
      return;
    }

    setSaving(true);
    setMsg(null);

    const resp = await fetch("/api/digests/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        enabled,
        slack_enabled: slackEnabled,
        email_enabled: emailEnabled,
        slack_channel_id: slackChannelId.trim() ? slackChannelId.trim() : null,
        email_recipients: emailsParsed,
        timezone,
        day_of_week: dayOfWeek,
        hour_local: hourLocal,
      }),
    });

    const json = await resp.json().catch(() => ({}));
    setSaving(false);

    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to save digest settings.");
      return;
    }

    setMsg("Saved.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold">Weekly digest</div>
          <div className="text-xs opacity-70">
            A weekly executive summary of high-risk, overdue, and escalated
            changes.
          </div>
        </div>
        <label className="text-sm flex items-center gap-2">
          <Input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={!isAdmin}
          />
          Enabled
        </label>
      </div>
      {loading ? (
        <div className="text-xs opacity-70">Loading…</div>
      ) : (
        <>
          {!isAdmin && (
            <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--text-muted)]">
              You can view digest settings, but only org admins can edit.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Delivery</div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm flex items-center gap-2">
                <Input
                  type="checkbox"
                  checked={slackEnabled}
                  onChange={(e) => setSlackEnabled(e.target.checked)}
                  disabled={!isAdmin || !enabled}
                />
                Slack
              </label>

              <label className="text-sm flex items-center gap-2">
                <Input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  disabled={!isAdmin || !enabled}
                />
                Email
              </label>
            </div>

            <div className="space-y-1">
              <div className="text-xs opacity-70">
                Slack channel override (optional)
              </div>
              <Input
                className="border rounded px-3 py-2 w-full"
                placeholder="C0123ABCDEF (leave blank to use default org channel)"
                value={slackChannelId}
                onChange={(e) => setSlackChannelId(e.target.value)}
                disabled={!isAdmin || !enabled || !slackEnabled}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs opacity-70">
                Email recipients override (optional)
              </div>
              <Textarea
                className="border rounded px-3 py-2 w-full min-h-24"
                placeholder={
                  "finance@company.com\nrevops@company.com\nops@company.com"
                }
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                disabled={!isAdmin || !enabled || !emailEnabled}
              />
              <div className="text-xs opacity-70">
                Leave blank to use org notification emails.
              </div>
            </div>

            <div className="border-t pt-3 grid grid-cols-1 gap-3">
              <div className="font-semibold text-sm">Schedule</div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs opacity-70">Day</div>
                  <NativeSelect
                    className="border rounded px-3 py-2 w-full"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    disabled={!isAdmin || !enabled}
                  >
                    {DOW.map((d) => (
                      <option key={d.v} value={d.v}>
                        {d.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1">
                  <div className="text-xs opacity-70">Hour (local)</div>
                  <Input
                    className="border rounded px-3 py-2 w-full"
                    type="number"
                    min={0}
                    max={23}
                    value={hourLocal}
                    onChange={(e) => setHourLocal(Number(e.target.value))}
                    disabled={!isAdmin || !enabled}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs opacity-70">Timezone</div>
                <Input
                  className="border rounded px-3 py-2 w-full"
                  placeholder="UTC"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={!isAdmin || !enabled}
                />
                <div className="text-xs opacity-70">
                  v1 tip: keep UTC; we'll make this auto-detect later.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                onClick={save}
                disabled={saving || !isAdmin}
                className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              {msg && <div className="text-xs opacity-70">{msg}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
