"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, Input, Switch, PageHeader, Stack } from "@/ui";
import type { OrgSettingsPayload } from "@/app/api/org/settings/route";

const ROUTES = ["IMMEDIATE", "DAILY_DIGEST", "WEEKLY_DIGEST"] as const;

type Props = { orgId: string; isAdmin: boolean };

export default function AttentionSettingsClient({ orgId, isAdmin }: Props) {
  const [payload, setPayload] = useState<OrgSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/org/settings?orgId=${encodeURIComponent(orgId)}`);
    const data = await res.json().catch(() => ({}));
    setPayload(data.settings ?? null);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!payload || !isAdmin) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/org/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        organization: payload.organization,
        notifications: payload.notifications,
        approvals: payload.approvals,
        attentionRouting: payload.attentionRouting,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setMsg("Attention settings saved.");
      await load();
    } else {
      setErr((json as { error?: string }).error ?? "Save failed");
    }
  }

  if (loading || !payload) {
    return <p className="text-sm text-[var(--text-muted)]">Loading…</p>;
  }

  const ar = payload.attentionRouting;

  return (
    <Stack gap={6}>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Attention routing", href: "/settings/attention" },
        ]}
        title="Attention routing"
        description="Thresholds and defaults for who gets interrupted, when, and how digests run. Composes with existing digest enablement."
        right={
          <Link href="/settings/organization" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Organization settings
          </Link>
        }
      />
      {msg && (
        <p className="rounded-md border border-[var(--success)] bg-[var(--success)]/10 px-3 py-2 text-sm">{msg}</p>
      )}
      {err && (
        <p className="rounded-md border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {err}
        </p>
      )}
      {!isAdmin && (
        <p className="text-sm text-[var(--text-muted)]">Only org owners and admins can edit these settings.</p>
      )}

      <Card>
        <CardHeader>Revenue thresholds (USD)</CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Executive</label>
            <Input
              type="number"
              min={0}
              value={ar.executiveRevenueEscalationThresholdUsd}
              disabled={!isAdmin}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  attentionRouting: {
                    ...ar,
                    executiveRevenueEscalationThresholdUsd: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Senior technical</label>
            <Input
              type="number"
              min={0}
              value={ar.seniorTechRevenueEscalationThresholdUsd}
              disabled={!isAdmin}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  attentionRouting: {
                    ...ar,
                    seniorTechRevenueEscalationThresholdUsd: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Department leader</label>
            <Input
              type="number"
              min={0}
              value={ar.departmentLeaderRevenueEscalationThresholdUsd}
              disabled={!isAdmin}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  attentionRouting: {
                    ...ar,
                    departmentLeaderRevenueEscalationThresholdUsd: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Deploy window & behavior</CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Immediate deploy window (hours)</label>
            <Input
              type="number"
              min={1}
              max={168}
              value={ar.immediateDeployWindowHours}
              disabled={!isAdmin}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  attentionRouting: {
                    ...ar,
                    immediateDeployWindowHours: Math.min(168, Math.max(1, Number(e.target.value) || 24)),
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Include medium-risk items in digests</p>
              <p className="text-xs text-[var(--text-muted)]">When off, digest routes skip medium-risk-only items.</p>
            </div>
            <Switch
              checked={ar.digestIncludeMediumRisk}
              disabled={!isAdmin}
              onCheckedChange={(v) =>
                setPayload({ ...payload, attentionRouting: { ...ar, digestIncludeMediumRisk: v } })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Suppress low-risk executive interruptions</p>
              <p className="text-xs text-[var(--text-muted)]">Reduces noise when no executive sign-off is required.</p>
            </div>
            <Switch
              checked={ar.suppressLowRiskExecNotifications}
              disabled={!isAdmin}
              onCheckedChange={(v) =>
                setPayload({
                  ...payload,
                  attentionRouting: { ...ar, suppressLowRiskExecNotifications: v },
                })
              }
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Default routes by persona</CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Executive", "executiveDefaultRoute"],
              ["Senior technical", "seniorTechDefaultRoute"],
              ["Department leader", "departmentLeaderDefaultRoute"],
              ["Operator", "operatorDefaultRoute"],
            ] as const
          ).map(([label, key]) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium">{label}</label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                disabled={!isAdmin}
                value={ar[key]}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    attentionRouting: {
                      ...ar,
                      [key]: e.target.value as (typeof ROUTES)[number],
                    },
                  })
                }
              >
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Attention digests (Slack)</CardHeader>
        <CardBody className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Requires org digest enabled and Slack connected. These flags add Solvren attention summaries on top of existing
            digest settings.
          </p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Daily attention digest</p>
            </div>
            <Switch
              checked={ar.attentionDailyDigestEnabled}
              disabled={!isAdmin}
              onCheckedChange={(v) =>
                setPayload({
                  ...payload,
                  attentionRouting: { ...ar, attentionDailyDigestEnabled: v },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Weekly attention digest</p>
            </div>
            <Switch
              checked={ar.attentionWeeklyDigestEnabled}
              disabled={!isAdmin}
              onCheckedChange={(v) =>
                setPayload({
                  ...payload,
                  attentionRouting: { ...ar, attentionWeeklyDigestEnabled: v },
                })
              }
            />
          </div>
        </CardBody>
      </Card>

      {isAdmin && (
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save attention settings"}
        </Button>
      )}
    </Stack>
  );
}
