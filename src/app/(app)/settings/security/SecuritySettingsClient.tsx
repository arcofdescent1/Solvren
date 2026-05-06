"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Stack } from "@/ui";
import { DataProtectionBadge } from "@/components/security/DataProtectionBadge";
import { DataBoundaryDiagram } from "@/components/security/DataBoundaryDiagram";
import type { PrivacyMode } from "@/lib/server/privacy/privacy-policy";

type Summary = {
  privacyMode: PrivacyMode;
  writeBackEnabled: boolean;
  expandedFinancialDetailEnabled?: boolean;
  rawPayloadStorage: string;
  piiHandling: string;
  credentials: string;
  employeeAccess: string;
  privacyPolicyVersion?: string;
  lastValidatedAt: string | null;
};

type TrustMetrics = {
  windowDays: number;
  ingestionJobsSucceeded: number;
  redactionValidationPassed: number;
  redactionValidationNote: string;
  rawPayloadPolicyViolations: number;
  writeBackDeniedAttempts: number;
};

export function SecuritySettingsClient(props: { orgId: string; canManage: boolean }) {
  const { orgId, canManage } = props;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trustMetrics, setTrustMetrics] = useState<TrustMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sumRes, trustRes] = await Promise.all([
      fetch(`/api/org/security/data-handling-summary?orgId=${encodeURIComponent(orgId)}`),
      fetch(`/api/org/security/trust-metrics?orgId=${encodeURIComponent(orgId)}&days=7`),
    ]);
    const j = (await sumRes.json()) as Summary & { error?: string };
    if (!sumRes.ok) {
      setError(j.error ?? "Failed to load");
      setSummary(null);
      setTrustMetrics(null);
    } else {
      setError(null);
      setSummary(j);
      const t = (await trustRes.json()) as TrustMetrics & { error?: string };
      setTrustMetrics(trustRes.ok ? t : null);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setPrivacyMode = async (privacyMode: PrivacyMode) => {
    setBusy(true);
    try {
      const res = await fetch("/api/org/security/privacy-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, privacyMode }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const setWriteBack = async (writeBackEnabled: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/org/security/write-back", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, writeBackEnabled }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const setExpandedFinancial = async (expandedFinancialDetailEnabled: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/org/security/privacy-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, privacyMode: summary?.privacyMode ?? "minimal", expandedFinancialDetailEnabled }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Loading security settings…</p>;
  if (error && !summary) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <Stack gap={6}>
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}

      <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Privacy mode</h2>
          {summary ? <DataProtectionBadge mode={summary.privacyMode} /> : null}
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          <strong>Minimal Data Mode</strong> is recommended. <strong>Expanded Insights Mode</strong> adds limited derived
          signals and bands—never raw revenue payloads.
        </p>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="default" disabled={busy} onClick={() => void setPrivacyMode("minimal")}>
              Use minimal mode
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void setPrivacyMode("expanded")}>
              Use expanded insights
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Only owners and admins can change privacy mode.</p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">Exact financial detail (expanded only)</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Admin-gated: allows limited exact financial fields in expanded mode per policy matrix.
        </p>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy || summary?.privacyMode !== "expanded"}
              onClick={() => void setExpandedFinancial(true)}
            >
              Enable (expanded)
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void setExpandedFinancial(false)}>
              Disable
            </Button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">Write-back to external systems</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Off by default. When disabled, execution tasks cannot mutate HubSpot, Salesforce, Stripe, Jira, etc.
        </p>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="default" disabled={busy} onClick={() => void setWriteBack(false)}>
              Keep read-only / write-back off
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void setWriteBack(true)}>
              Enable write-back (audited)
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Only owners and admins can change write-back.</p>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">Last {trustMetrics?.windowDays ?? 7} days — operational trust metrics</h2>
        <p className="text-xs text-[var(--text-muted)]">
          From recorded events and audit logs only. Shown when your organization has activity in this window.
        </p>
        {trustMetrics ? (
          <ul className="list-inside list-disc text-sm text-[var(--text-muted)]">
            <li>{trustMetrics.ingestionJobsSucceeded} ingestion jobs completed successfully</li>
            <li>{trustMetrics.redactionValidationPassed} passed redaction validation (see note below)</li>
            <li>{trustMetrics.rawPayloadPolicyViolations} raw payload policy blocks</li>
            <li>{trustMetrics.writeBackDeniedAttempts} write-back attempts while disabled (audited)</li>
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Trust metrics unavailable.</p>
        )}
        {trustMetrics?.redactionValidationNote ? (
          <p className="text-xs text-[var(--text-muted)]">{trustMetrics.redactionValidationNote}</p>
        ) : null}
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">Data handling summary</h2>
        <ul className="list-inside list-disc text-sm text-[var(--text-muted)]">
          <li>Raw payloads: {summary?.rawPayloadStorage ?? "—"}</li>
          <li>PII: {summary?.piiHandling ?? "—"}</li>
          <li>Credentials: {summary?.credentials ?? "—"}</li>
          <li>Employee access: {summary?.employeeAccess ?? "—"}</li>
          <li>Policy version: {summary?.privacyPolicyVersion ?? "—"}</li>
          <li>Write-back: {summary?.writeBackEnabled ? "enabled" : "disabled"}</li>
        </ul>
      </section>

      <DataBoundaryDiagram />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Related</h2>
        <Link href="/settings/security/support-access" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Support access →
        </Link>
      </section>
    </Stack>
  );
}
