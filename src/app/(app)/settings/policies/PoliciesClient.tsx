"use client";

import { Button, Card, CardBody, Input, NativeSelect, PageHeader } from "@/ui";
import { Checkbox } from "@/ui/primitives/checkbox";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck, Plus, Trash2, Sparkles } from "lucide-react";

type Policy = {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  rule_config: Record<string, unknown>;
  systems_affected: string[];
  enforcement_mode: "MONITOR" | "REQUIRE_APPROVAL" | "BLOCK";
  enabled: boolean;
  priority: number;
};

const RULE_TYPES = [
  { value: "DISCOUNT_LIMIT", label: "Discount Limit" },
  { value: "PRICING_CHANGE", label: "Pricing Change" },
  { value: "BILLING_RULE", label: "Billing Rule" },
  { value: "CONTRACT_THRESHOLD", label: "Contract Threshold" },
  { value: "CUSTOM", label: "Custom" },
];

const ENFORCEMENT_MODES = [
  { value: "MONITOR", label: "Monitor" },
  { value: "REQUIRE_APPROVAL", label: "Require Approval" },
  { value: "BLOCK", label: "Block" },
];

function enforcementBadge(mode: string) {
  const c =
    mode === "BLOCK" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" :
    mode === "REQUIRE_APPROVAL" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" :
    "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${c}`}>{mode.replace("_", " ")}</span>;
}

export default function PoliciesClient() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ruleType, setRuleType] = useState("DISCOUNT_LIMIT");
  const [systemsAffected, setSystemsAffected] = useState("");
  const [enforcementMode, setEnforcementMode] = useState<"MONITOR" | "REQUIRE_APPROVAL" | "BLOCK">("REQUIRE_APPROVAL");
  const [threshold, setThreshold] = useState("30");
  const [enabled, setEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; description: string; rule_type: string; enforcement_mode: string; rule_config?: Record<string, unknown> }>>([]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/policies");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load");
      setPolicies((json as { policies?: Policy[] }).policies ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch("/api/ai/policy-suggestions")
      .then((r) => r.json())
      .then((j) => { if (j.ok && Array.isArray(j.suggestions)) setSuggestions(j.suggestions); })
      .catch(() => {});
  }, []);

  async function create() {
    setMsg(null);
    const n = name.trim();
    if (!n) return;
    const cfg: Record<string, unknown> = {};
    if (ruleType === "DISCOUNT_LIMIT") cfg.threshold = Number(threshold) || 30;
    if (ruleType === "CONTRACT_THRESHOLD") cfg.threshold = Number(threshold) || 1_000_000;
    const res = await fetch("/api/settings/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: n,
        description: description.trim() || undefined,
        rule_type: ruleType,
        rule_config: cfg,
        systems_affected: systemsAffected ? systemsAffected.split(",").map((s) => s.trim()).filter(Boolean) : [],
        enforcement_mode: enforcementMode,
        enabled,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg((json as { error?: string }).error ?? "Failed"); return; }
    setName("");
    setDescription("");
    setThreshold("30");
    await load();
    setMsg("Policy created.");
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    setMsg(null);
    const res = await fetch(`/api/settings/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg((json as { error?: string }).error ?? "Failed"); return; }
    await load();
    setMsg("Saved.");
  }

  async function remove(id: string) {
    setMsg(null);
    const res = await fetch(`/api/settings/policies/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg((json as { error?: string }).error ?? "Failed"); return; }
    await load();
    setMsg("Policy deleted.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "Revenue Policies" },
        ]}
        title="Revenue Policies"
        description="Enforce revenue control across systems. Monitor, require approval, or block changes before they are applied."
        right={
          <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Settings
          </Link>
        }
      />

      {msg ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text)]">
          {msg}
        </div>
      ) : null}

      {suggestions.length > 0 && (
        <Card className="border-[var(--primary)]/20 bg-gradient-to-br from-[var(--primary)]/5 to-transparent">
          <CardBody>
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Sparkles className="h-5 w-5 text-[var(--primary)]" />
              Suggested policies
            </h2>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              Based on your recent risk events. Apply a suggestion to create the policy.
            </p>
            <div className="flex flex-wrap gap-3">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3"
                >
                  <div>
                    <p className="font-medium text-[var(--text)]">{s.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{s.description}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      setName(s.name);
                      setDescription(s.description);
                      setRuleType(s.rule_type);
                      setEnforcementMode(s.enforcement_mode as Policy["enforcement_mode"]);
                      if (s.rule_config?.threshold) setThreshold(String(s.rule_config.threshold));
                    }}
                  >
                    Use
                  </Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="border-[var(--primary)]/30">
        <CardBody>
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
            Add policy
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Name</label>
              <Input placeholder="e.g. Discount Limits" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Rule type</label>
              <NativeSelect value={ruleType} onChange={(e) => setRuleType(e.target.value)} className="mt-1">
                {RULE_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Enforcement</label>
              <NativeSelect value={enforcementMode} onChange={(e) => setEnforcementMode(e.target.value as Policy["enforcement_mode"])} className="mt-1">
                {ENFORCEMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </NativeSelect>
            </div>
            {(ruleType === "DISCOUNT_LIMIT" || ruleType === "CONTRACT_THRESHOLD") && (
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  {ruleType === "DISCOUNT_LIMIT" ? "Max discount %" : "Threshold ($)"}
                </label>
                <Input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder={ruleType === "DISCOUNT_LIMIT" ? "30" : "1000000"}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Systems (comma-separated)</label>
              <Input placeholder="Salesforce, NetSuite, Stripe" value={systemsAffected} onChange={(e) => setSystemsAffected(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
              <span className="text-sm text-[var(--text-muted)]">Enabled</span>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={create} disabled={!name.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Add policy
            </Button>
          </div>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold">Active policies</h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        ) : policies.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--text-muted)]">
                No policies yet. Add a policy to enforce revenue rules across Salesforce, NetSuite, billing systems, and more.
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {policies.map((p) => (
              <Card key={p.id} className="transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-[var(--text)]">{p.name}</h3>
                    {enforcementBadge(p.enforcement_mode)}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{p.rule_type.replace(/_/g, " ")}</p>
                  {p.description && <p className="mt-1 text-sm text-[var(--text-muted)]">{p.description}</p>}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Systems: {(p.systems_affected?.length ? p.systems_affected : ["All"]).join(", ")}
                  </p>
                  {p.rule_config && Object.keys(p.rule_config).length > 0 && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Config: {JSON.stringify(p.rule_config)}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Checkbox checked={p.enabled} onCheckedChange={(v) => toggleEnabled(p.id, Boolean(v))} />
                    <span className="text-xs text-[var(--text-muted)]">Enabled</span>
                    <Button variant="secondary" size="sm" className="ml-auto" onClick={() => remove(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
