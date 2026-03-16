"use client";;
import { Button } from "@/ui";

import { useState } from "react";

type Billing = {
  org_id: string;
  plan_key: "FREE" | "TEAM" | "BUSINESS";
  status: string;
  current_period_end: string | null;
};

export default function BillingPanel({
  orgId,
  isAdmin,
}: {
  orgId: string;
  isAdmin: boolean;
}) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    const resp = await fetch(
      `/api/billing/status?orgId=${encodeURIComponent(orgId)}`
    );
    const json = await resp.json().catch(() => ({}));
    setLoading(false);
    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to load billing.");
      return;
    }
    setBilling(json.billing);
  }

  async function goCheckout(plan: "TEAM" | "BUSINESS") {
    if (!isAdmin) {
      setMsg("Admin required to manage billing.");
      return;
    }
    setLoading(true);
    setMsg(null);
    const resp = await fetch("/api/billing/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, plan }),
    });
    const json = await resp.json().catch(() => ({}));
    setLoading(false);
    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to start checkout.");
      return;
    }
    if (json?.url) window.location.href = json.url;
  }

  async function openPortal() {
    if (!isAdmin) {
      setMsg("Admin required to manage billing.");
      return;
    }
    setLoading(true);
    setMsg(null);
    const resp = await fetch("/api/billing/create-portal-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    const json = await resp.json().catch(() => ({}));
    setLoading(false);
    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to open billing portal.");
      return;
    }
    if (json?.url) window.location.href = json.url;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">Billing</h3>
        <Button
          onClick={load}
          className="text-xs underline"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Plans gate Slack + digests. Start on Free, upgrade when you want
        team-wide risk visibility.
      </p>
      {billing ? (
        <div className="text-sm text-[var(--text)]">
          <div>
            Plan: <span className="font-semibold">{billing.plan_key}</span>
          </div>
          <div className="text-sm text-[var(--text-muted)]">Status: {billing.status}</div>
          {billing.current_period_end && (
            <div className="text-sm text-[var(--text-muted)]">
              Renews:{" "}
              {new Date(billing.current_period_end).toLocaleString()}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-[var(--text-muted)]">
          Click Refresh to load current plan.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => goCheckout("TEAM")}
          disabled={loading || !isAdmin}
          variant="default"
        >
          Upgrade to Team
        </Button>
        <Button
          onClick={() => goCheckout("BUSINESS")}
          disabled={loading || !isAdmin}
          variant="outline"
        >
          Upgrade to Business
        </Button>
        <Button
          onClick={openPortal}
          disabled={loading || !isAdmin}
          variant="outline"
        >
          Manage billing
        </Button>
      </div>
      {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
      {!isAdmin && (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--text-muted)]">
          Only org admins can upgrade or manage billing.
        </div>
      )}
    </div>
  );
}
