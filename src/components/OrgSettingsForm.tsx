"use client";;
import { Button, Input, Textarea } from "@/ui";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  org_id: string;
  slack_enabled: boolean;
  slack_webhook_url: string | null;
  email_enabled: boolean;
  notification_emails: string[] | null;
};

function parseEmails(input: string) {
  const parts = input
    .split(/[\n,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const uniq = Array.from(new Set(parts.map((s) => s.toLowerCase())));
  return uniq.length ? uniq : null;
}

export default function OrgSettingsForm({
  orgId,
  initial,
  isAdmin,
}: {
  orgId: string;
  initial: Settings;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [slackEnabled, setSlackEnabled] = useState(Boolean(initial.slack_enabled));
  const [slackWebhook, setSlackWebhook] = useState(
    initial.slack_webhook_url ?? ""
  );
  const [emailEnabled, setEmailEnabled] = useState(
    Boolean(initial.email_enabled)
  );
  const [emailsText, setEmailsText] = useState(
    (initial.notification_emails ?? []).join("\n")
  );

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const emailsParsed = useMemo(() => parseEmails(emailsText), [emailsText]);

  async function save() {
    if (!isAdmin) {
      setMsg("Admin required to change settings.");
      return;
    }
    setSaving(true);
    setMsg(null);

    const resp = await fetch("/api/org/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        slack_enabled: slackEnabled,
        slack_webhook_url: slackWebhook.trim() ? slackWebhook.trim() : null,
        email_enabled: emailEnabled,
        notification_emails: emailsParsed,
      }),
    });

    const json = await resp.json().catch(() => ({}));
    setSaving(false);

    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to save.");
      return;
    }

    setMsg("Saved.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--text-muted)]">
          You can view settings, but only org admins can edit.
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Slack</div>
          <label className="text-sm flex items-center gap-2">
            <Input
              type="checkbox"
              checked={slackEnabled}
              onChange={(e) => setSlackEnabled(e.target.checked)}
              disabled={!isAdmin}
            />
            Enabled
          </label>
        </div>
        <Input
          className="border rounded px-3 py-2 w-full"
          placeholder="Slack webhook URL"
          value={slackWebhook}
          onChange={(e) => setSlackWebhook(e.target.value)}
          disabled={!isAdmin}
        />
        <div className="text-xs opacity-70">
          Tip: Slack → Apps → Incoming Webhooks → copy the webhook URL.
        </div>
      </div>
      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Email</div>
          <label className="text-sm flex items-center gap-2">
            <Input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              disabled={!isAdmin}
            />
            Enabled
          </label>
        </div>

        <Textarea
          className="border rounded px-3 py-2 w-full min-h-28"
          placeholder={
            "Notification emails (one per line)\nops@company.com\nfinance@company.com"
          }
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          disabled={!isAdmin}
        />

        <div className="text-xs opacity-70">
          We&apos;ll send org-level alerts (due soon/overdue/approval requested)
          to these addresses.
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Button
          onClick={save}
          disabled={saving || !isAdmin}
          variant="default"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
      </div>
    </div>
  );
}
