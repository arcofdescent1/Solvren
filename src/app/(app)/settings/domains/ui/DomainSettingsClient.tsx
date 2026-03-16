"use client";

import { Button, Card, CardBody, Input, NativeSelect, Table } from "@/ui";
import { Checkbox } from "@/ui/primitives/checkbox";
import { useEffect, useMemo, useState } from "react";

type Domain = {
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
};
type OrgDomain = { domain_key: string; enabled: boolean; config: unknown };
type OrgPolicy = { domain_key: string; sla_policy_key: string; config: unknown };
type SlaPolicy = {
  domain_key: string;
  policy_key: string;
  due_hours: number;
  due_soon_hours: number;
  escalation_hours: number;
};
type DomainSignal = {
  domain_key: string;
  signal_key: string;
  name: string;
  description: string | null;
  severity: string;
  default_weight: number;
};
type Override = {
  domain_key: string;
  signal_key: string;
  enabled: boolean;
  weight_override: number | null;
};

function moneyOrNum(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return String(v);
}

export default function DomainSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [schemaAvailable, setSchemaAvailable] = useState(true);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [orgDomains, setOrgDomains] = useState<OrgDomain[]>([]);
  const [orgPolicies, setOrgPolicies] = useState<OrgPolicy[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<SlaPolicy[]>([]);
  const [domainSignals, setDomainSignals] = useState<DomainSignal[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/settings/domains");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load domain settings");

      setSchemaAvailable(json.schemaAvailable !== false);
      setDomains(json.domains ?? []);
      setOrgDomains(json.orgDomains ?? []);
      setOrgPolicies(json.orgPolicies ?? []);
      setSlaPolicies(json.slaPolicies ?? []);
      setDomainSignals(json.domainSignals ?? []);
      setOverrides(json.overrides ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const orgDomainMap = useMemo(() => {
    const m = new Map<string, OrgDomain>();
    for (const od of orgDomains) m.set(od.domain_key, od);
    return m;
  }, [orgDomains]);

  const orgPolicyMap = useMemo(() => {
    const m = new Map<string, OrgPolicy>();
    for (const op of orgPolicies) m.set(op.domain_key, op);
    return m;
  }, [orgPolicies]);

  const overridesMap = useMemo(() => {
    const m = new Map<string, Override>();
    for (const o of overrides) m.set(`${o.domain_key}:${o.signal_key}`, o);
    return m;
  }, [overrides]);

  const signalsByDomain = useMemo(() => {
    const m = new Map<string, DomainSignal[]>();
    for (const s of domainSignals) {
      const k = s.domain_key;
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [domainSignals]);

  const slaByDomain = useMemo(() => {
    const m = new Map<string, SlaPolicy[]>();
    for (const p of slaPolicies) {
      const k = p.domain_key;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [slaPolicies]);

  async function update(body: {
    type: string;
    domainKey: string;
    enabled?: boolean;
    policyKey?: string;
    signalKey?: string;
    weightOverride?: number | null;
  }) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/settings/domains/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Update failed");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-[var(--text-muted)]">Loading…</div>;

  const recommended = ["SECURITY", "DATA", "WORKFLOW"].filter(
    (k) => !(orgDomainMap.get(k)?.enabled ?? false)
  );

  return (
    <div className="space-y-6">
      {err ? (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--danger)]">{err}</p>
          </CardBody>
        </Card>
      ) : null}
      {!schemaAvailable ? (
        <Card className="border-[var(--danger)]/30 bg-[var(--danger)]/5">
          <CardBody className="space-y-2">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              Domain management not configured
            </h2>
            <p className="text-sm text-[var(--text)]">
              The database schema for domain settings (domains, org_domains, etc.) is missing.
              Until migrations are run, you cannot enable domains or configure SLA policies and signal weights.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Contact your administrator to run the domain migrations (e.g. <code className="rounded bg-[var(--bg-surface-2)] px-1">073_domains_core.sql</code> and related).
            </p>
          </CardBody>
        </Card>
      ) : null}
      {schemaAvailable && recommended.length > 0 ? (
        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Recommended domains
            </h2>
            <p className="text-sm text-[var(--text)]">
              Enable additional domains to reuse the same governance engine across your stack.
            </p>
            <div className="flex flex-wrap gap-2">
              {recommended.map((k) => (
                <Button
                  key={k}
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    update({ type: "DOMAIN_TOGGLE", domainKey: k, enabled: true })
                  }
                >
                  Enable {k}
                </Button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Each domain adds governance signals (SECURITY, DATA, WORKFLOW) for that risk area.
            </p>
          </CardBody>
        </Card>
      ) : null}
      {domains.map((d) => {
        const enabled = orgDomainMap.get(d.key)?.enabled ?? false;
        const policyKey = orgPolicyMap.get(d.key)?.sla_policy_key ?? "DEFAULT";
        const policies = slaByDomain.get(d.key) ?? [];
        const signals = signalsByDomain.get(d.key) ?? [];
        const policyOptions =
          policies.length > 0
            ? policies
            : [
                {
                  domain_key: d.key,
                  policy_key: "DEFAULT",
                  due_hours: 48,
                  due_soon_hours: 24,
                  escalation_hours: 72,
                },
              ];

        return (
          <Card key={d.key}>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[var(--text)]">
                    {d.name} <span className="text-xs text-[var(--text-muted)]">({d.key})</span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">
                    {d.description ?? "—"}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <Checkbox
                      checked={enabled}
                      disabled={saving}
                      onCheckedChange={(v) =>
                        update({
                          type: "DOMAIN_TOGGLE",
                          domainKey: d.key,
                          enabled: Boolean(v),
                        })
                      }
                    />
                    Enabled
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">SLA</span>
                    <NativeSelect
                      className="rounded-lg border border-[var(--border)] p-2 text-sm"
                      disabled={!enabled || saving}
                      value={policyKey}
                      onChange={(e) =>
                        update({
                          type: "SLA_POLICY",
                          domainKey: d.key,
                          policyKey: e.target.value,
                        })
                      }
                    >
                    {policyOptions.map((p) => (
                      <option key={p.policy_key} value={p.policy_key}>
                        {p.policy_key} ({p.due_hours}h due / {p.due_soon_hours}h
                        soon / {p.escalation_hours}h escal)
                      </option>
                    ))}
                    </NativeSelect>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Signals
                </h3>
                <div className="overflow-auto rounded-lg border border-[var(--border)]">
                  <Table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-[var(--table-header-bg)]">
                    <tr className="text-left">
                      <th className="p-3">Signal</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Enabled</th>
                      <th className="p-3">Weight</th>
                      <th className="p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s) => {
                      const ov = overridesMap.get(`${s.domain_key}:${s.signal_key}`);
                      const sEnabled = ov ? !!ov.enabled : true;
                      const weight = ov?.weight_override ?? s.default_weight;

                      return (
                        <tr key={s.signal_key} className="border-t border-[var(--border)]">
                          <td className="p-3 font-semibold text-[var(--text)]">{s.name}</td>
                          <td className="p-3 text-[var(--text)]">{s.severity}</td>
                          <td className="p-3">
                            <Checkbox
                              checked={sEnabled}
                              disabled={!enabled || saving}
                              onCheckedChange={(v) =>
                                update({
                                  type: "SIGNAL_OVERRIDE",
                                  domainKey: s.domain_key,
                                  signalKey: s.signal_key,
                                  enabled: Boolean(v),
                                  weightOverride: ov?.weight_override ?? null,
                                })
                              }
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              className="w-24 rounded-lg border border-[var(--border)] p-2"
                              disabled={!enabled || saving || !sEnabled}
                              value={moneyOrNum(weight)}
                              onChange={(e) => {
                                const vRaw = e.target.value.trim();
                                const v = vRaw === "" ? null : Number(vRaw);
                                update({
                                  type: "SIGNAL_OVERRIDE",
                                  domainKey: s.domain_key,
                                  signalKey: s.signal_key,
                                  enabled: sEnabled,
                                  weightOverride:
                                    v != null && Number.isFinite(v) ? v : null,
                                });
                              }}
                            />
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              0.3–3.0
                            </div>
                          </td>
                          <td className="p-3 text-[var(--text)]">
                            {s.description ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {!signals.length ? (
                      <tr>
                        <td className="p-3 text-[var(--text-muted)]" colSpan={5}>
                          No signals defined for this domain yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </Table>
                </div>

              {!enabled ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Enable the domain to edit its SLA policy and signal settings.
                </p>
              ) : null}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
