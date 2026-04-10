"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  Card,
  CardBody,
  CardHeader,
  Switch,
  Badge,
} from "@/ui";
import type { OrgSettingsPayload } from "@/app/api/org/settings/route";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

function EmailChipInput({
  emails,
  onChange,
  disabled,
  placeholder = "Add email address",
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const addEmail = () => {
    const raw = input.trim().toLowerCase();
    if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return;
    if (emails.includes(raw)) {
      setInput("");
      return;
    }
    onChange([...emails, raw]);
    setInput("");
  };

  const remove = (i: number) => {
    onChange(emails.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-2 min-h-[2.5rem]">
        {emails.map((e, i) => (
          <span
            key={`${e}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-sm"
          >
            {e}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-full p-0.5 hover:bg-[var(--bg-surface)]"
                aria-label={`Remove ${e}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            type="email"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addEmail();
              }
            }}
            onBlur={addEmail}
            className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
          />
        )}
      </div>
    </div>
  );
}

type Props = {
  orgId: string;
  isAdmin: boolean;
};

export default function OrganizationSettingsClient({ orgId, isAdmin }: Props) {
  const [payload, setPayload] = useState<OrgSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/org/settings?orgId=${encodeURIComponent(orgId)}`);
    const data = await res.json().catch(() => ({}));
    setPayload(data.settings ?? null);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function put(partial: Partial<{ organization: OrgSettingsPayload["organization"]; notifications: OrgSettingsPayload["notifications"]; approvals: OrgSettingsPayload["approvals"] }>) {
    if (!payload) return;
    setErrorMsg(null);
    const body = {
      orgId,
      organization: partial.organization ?? payload.organization,
      notifications: partial.notifications ?? payload.notifications,
      approvals: partial.approvals ?? payload.approvals,
      domains: payload.domains,
      integrations: payload.integrations,
      attentionRouting: payload.attentionRouting,
    };
    const res = await fetch("/api/org/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setPayload({ ...payload, ...partial });
      return true;
    }
    setErrorMsg((json as { error?: string }).error ?? "Failed to save");
    return false;
  }

  async function saveProfile() {
    if (!payload || !isAdmin) return;
    setSavingSection("profile");
    const ok = await put({
      organization: {
        name: payload.organization.name,
        timezone: payload.organization.timezone,
        primaryNotificationEmail: payload.organization.primaryNotificationEmail,
      },
    });
    setSavingSection(null);
    if (ok) showSuccess("Organization profile saved.");
  }

  async function saveNotifications() {
    if (!payload || !isAdmin) return;
    setSavingSection("notifications");
    const ok = await put({
      notifications: {
        ...payload.notifications,
        notificationEmails: payload.notifications.notificationEmails,
        dailyInboxEnabled: payload.notifications.dailyInboxEnabled,
        weeklyDigestEnabled: payload.notifications.weeklyDigestEnabled,
      },
    });
    setSavingSection(null);
    if (ok) showSuccess("Notification settings saved.");
  }

  async function saveApprovals() {
    if (!payload || !isAdmin) return;
    setSavingSection("approvals");
    const ok = await put({
      approvals: {
        defaultReviewSlaHours: payload.approvals.defaultReviewSlaHours,
        requireEvidenceBeforeApproval: payload.approvals.requireEvidenceBeforeApproval,
      },
    });
    setSavingSection(null);
    if (ok) showSuccess("Approval defaults saved.");
  }

  if (loading || !payload) {
    return <p className="text-sm text-[var(--text-muted)]">Loading settings…</p>;
  }

  return (
    <div className="space-y-6">
      {successMsg && (
        <p className="rounded-md border border-[var(--success)] bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--text)]">
          {successMsg}
        </p>
      )}
      {errorMsg && (
        <p className="rounded-md border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {errorMsg}
        </p>
      )}

      <p className="text-sm text-[var(--text-muted)]">
        For interruption thresholds and digest routing, open{" "}
        <Link href="/settings/attention" className="font-semibold text-[var(--primary)] hover:underline">
          Attention routing
        </Link>
        .
      </p>

      {/* 1. Organization Profile */}
      <Card>
        <CardHeader>Organization profile</CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Organization name</label>
            <Input
              value={payload.organization.name}
              onChange={(e) => setPayload({ ...payload, organization: { ...payload.organization, name: e.target.value } })}
              disabled={!isAdmin}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Timezone</label>
            <select
              value={payload.organization.timezone}
              onChange={(e) => setPayload({ ...payload, organization: { ...payload.organization, timezone: e.target.value } })}
              disabled={!isAdmin}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Used for daily inbox, weekly digest, and SLA interpretation.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Primary notification email</label>
            <Input
              type="email"
              value={payload.organization.primaryNotificationEmail ?? ""}
              onChange={(e) => setPayload({ ...payload, organization: { ...payload.organization, primaryNotificationEmail: e.target.value.trim() || null } })}
              disabled={!isAdmin}
              placeholder="ops@acme.com"
            />
          </div>
          {isAdmin && (
            <Button onClick={saveProfile} disabled={savingSection === "profile"}>
              {savingSection === "profile" ? "Saving…" : "Save"}
            </Button>
          )}
        </CardBody>
      </Card>

      {/* 2. Notifications */}
      <Card>
        <CardHeader>Notifications</CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Notification emails</label>
            <EmailChipInput
              emails={payload.notifications.notificationEmails}
              onChange={(emails) => setPayload({ ...payload, notifications: { ...payload.notifications, notificationEmails: emails } })}
              disabled={!isAdmin}
              placeholder="Add email"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Org-level alerts and summaries are sent to these addresses.</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--text)]">Daily inbox</p>
              <p className="text-xs text-[var(--text-muted)]">Daily summary of changes and due items.</p>
            </div>
            <Switch
              checked={payload.notifications.dailyInboxEnabled}
              onCheckedChange={(v) => setPayload({ ...payload, notifications: { ...payload.notifications, dailyInboxEnabled: v } })}
              disabled={!isAdmin}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--text)]">Weekly digest</p>
              <p className="text-xs text-[var(--text-muted)]">Weekly summary sent according to digest schedule.</p>
            </div>
            <Switch
              checked={payload.notifications.weeklyDigestEnabled}
              onCheckedChange={(v) => setPayload({ ...payload, notifications: { ...payload.notifications, weeklyDigestEnabled: v } })}
              disabled={!isAdmin}
            />
          </div>
          {isAdmin && (
            <Button onClick={saveNotifications} disabled={savingSection === "notifications"}>
              {savingSection === "notifications" ? "Saving…" : "Save"}
            </Button>
          )}
        </CardBody>
      </Card>

      {/* 3. Approval Defaults */}
      <Card>
        <CardHeader>Approval defaults</CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Default review SLA (hours)</label>
            <Input
              type="number"
              min={1}
              max={720}
              value={payload.approvals.defaultReviewSlaHours ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setPayload({
                  ...payload,
                  approvals: { ...payload.approvals, defaultReviewSlaHours: v === "" ? null : Math.max(1, Math.min(720, Number(v))) },
                });
              }}
              disabled={!isAdmin}
              placeholder="48"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Default target for review completion (e.g. 48 for 2 days).</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--text)]">Require evidence before approval</p>
              <p className="text-xs text-[var(--text-muted)]">Global default for change approvals.</p>
            </div>
            <Switch
              checked={payload.approvals.requireEvidenceBeforeApproval}
              onCheckedChange={(v) => setPayload({ ...payload, approvals: { ...payload.approvals, requireEvidenceBeforeApproval: v } })}
              disabled={!isAdmin}
            />
          </div>
          {isAdmin && (
            <Button onClick={saveApprovals} disabled={savingSection === "approvals"}>
              {savingSection === "approvals" ? "Saving…" : "Save"}
            </Button>
          )}
        </CardBody>
      </Card>

      {/* 4. Domains / Governance Defaults */}
      <Card>
               <CardHeader>Governance domains</CardHeader>
        <CardBody className="space-y-4">
          {payload.domains.activeDomains.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No domains configured. Configure domains in Domain settings.</p>
          ) : (
            <ul className="space-y-2">
              {payload.domains.activeDomains.map((d) => (
                <li key={d.key} className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2">
                  <span className="font-medium">{d.name}</span>
                  <Badge variant={d.enabled ? "success" : "secondary"}>{d.enabled ? "Enabled" : "Disabled"}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-[var(--text-muted)]">Domain defaults and owners can be configured in Domain settings.</p>
        </CardBody>
      </Card>

      {/* 5. Integrations */}
      <Card>
        <CardHeader>Integrations</CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2">
            <span className="font-medium">Slack</span>
            <Badge variant={payload.integrations.slackConnected ? "success" : "secondary"}>
              {payload.integrations.slackConnected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">Manage billing</a>
            <a href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">Connected systems</a>
          </div>
        </CardBody>
      </Card>

      {/* 6. Danger Zone */}
      <Card className="border-[var(--danger)]/30">
        <CardHeader className="text-[var(--text-muted)]">Danger zone</CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Destructive org actions (archive, transfer ownership) will be available here in a future release.</p>
        </CardBody>
      </Card>
    </div>
  );
}
