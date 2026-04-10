"use client";

import { Button, Card, CardBody, CardHeader, CardTitle, Input, NativeSelect, Table, Textarea } from "@/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type Domain = {
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
};
type Sla = {
  domain_key: string;
  policy_key: string;
  due_hours: number;
  due_soon_hours: number;
  escalation_hours: number;
};
type Signal = {
  domain_key: string;
  signal_key: string;
  name: string;
  description: string | null;
  severity: string;
  default_weight: number;
  detector: Record<string, unknown>;
};
type Mit = {
  domain_key: string;
  signal_key: string;
  mitigation_key: string;
  recommendation: string;
  severity: string;
};

function jsonPretty(v: unknown): string {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default function DomainBuilderClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [sla, setSla] = useState<Sla[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [mits, setMits] = useState<Mit[]>([]);

  const [selectedDomain, setSelectedDomain] = useState<string>("REVENUE");
  const [selectedSignal, setSelectedSignal] = useState<string>("");

  const [domainEdit, setDomainEdit] = useState({
    key: "",
    name: "",
    description: "",
    isActive: true,
  });
  const [slaEdit, setSlaEdit] = useState({
    policyKey: "DEFAULT",
    dueHours: 48,
    dueSoonHours: 24,
    escalationHours: 72,
  });
  const [signalEdit, setSignalEdit] = useState({
    signalKey: "",
    name: "",
    description: "",
    severity: "MEDIUM",
    defaultWeight: 1.0,
    detectorText:
      '{\n  "keywords": ["example"],\n  "regex": "(example)"\n}',
  });
  const [mitEdit, setMitEdit] = useState({
    mitigationKey: "",
    recommendation: "",
    severity: "MEDIUM",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/domains");
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.error || "Failed to load admin domains");

      setDomains(json.domains ?? []);
      setSla(json.slaPolicies ?? []);
      setSignals(json.signals ?? []);
      setMits(json.mitigations ?? []);

      const has = (json.domains ?? []).some(
        (d: Domain) => d.key === selectedDomain
      );
      if (!has && (json.domains ?? []).length) {
        setSelectedDomain((json.domains ?? [])[0].key);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [selectedDomain]);

  useEffect(() => {
    void load();
  }, [load]);

  const domainsMap = useMemo(
    () => new Map(domains.map((d) => [d.key, d])),
    [domains]
  );

  const slaForDomain = useMemo(
    () => sla.filter((p) => p.domain_key === selectedDomain),
    [sla, selectedDomain]
  );

  const signalsForDomain = useMemo(
    () => signals.filter((s) => s.domain_key === selectedDomain),
    [signals, selectedDomain]
  );

  const mitsForSignal = useMemo(
    () =>
      mits.filter(
        (m) =>
          m.domain_key === selectedDomain && m.signal_key === selectedSignal
      ),
    [mits, selectedDomain, selectedSignal]
  );

  async function update(body: Record<string, unknown>) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/domains/update", {
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

  function pickSignal(sigKey: string) {
    setSelectedSignal(sigKey);
    const s = signalsForDomain.find((x) => x.signal_key === sigKey);
    if (!s) return;
    setSignalEdit({
      signalKey: s.signal_key,
      name: s.name,
      description: s.description ?? "",
      severity: s.severity ?? "MEDIUM",
      defaultWeight: Number(s.default_weight ?? 1),
      detectorText: jsonPretty(s.detector ?? {}),
    });
  }

  if (loading) return <div className="text-sm text-[color:var(--rg-muted)]">Loading…</div>;

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-[var(--rg-radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Domain</CardTitle>
        </CardHeader>
        <CardBody>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <NativeSelect
            className="min-w-[160px]"
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value);
              setSelectedSignal("");
            }}
            disabled={saving}
          >
            {domains.map((d) => (
              <option key={d.key} value={d.key}>
                {d.key}
              </option>
            ))}
          </NativeSelect>

          <div className="text-sm text-[color:var(--rg-muted)]">
            {domainsMap.get(selectedDomain)?.name ?? ""} —{" "}
            {domainsMap.get(selectedDomain)?.description ?? ""}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            placeholder="KEY (e.g. SECURITY)"
            value={domainEdit.key}
            onChange={(e) =>
              setDomainEdit((s) => ({ ...s, key: e.target.value }))
            }
          />
          <Input
            placeholder="Name"
            value={domainEdit.name}
            onChange={(e) =>
              setDomainEdit((s) => ({ ...s, name: e.target.value }))
            }
          />
          <Input
            className="md:col-span-2"
            placeholder="Description"
            value={domainEdit.description}
            onChange={(e) =>
              setDomainEdit((s) => ({ ...s, description: e.target.value }))
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <Input
              type="checkbox"
              checked={domainEdit.isActive}
              onChange={(e) =>
                setDomainEdit((s) => ({ ...s, isActive: e.target.checked }))
              }
            />
            Active
          </label>
          <div className="md:col-span-2">
            <Button
            disabled={saving || !domainEdit.key || !domainEdit.name}
            onClick={() =>
              update({
                type: "UPSERT_DOMAIN",
                key: domainEdit.key,
                name: domainEdit.name,
                description: domainEdit.description || null,
                isActive: domainEdit.isActive,
              })
            }
            >
              Save Domain
            </Button>
          </div>
        </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>SLA Policies</CardTitle>
          <div className="mt-1 text-sm text-[color:var(--rg-muted)]">
            Per-domain SLA templates (orgs choose one per domain).
          </div>
        </CardHeader>
        <CardBody>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Input
            placeholder="Policy key (DEFAULT/CRITICAL)"
            value={slaEdit.policyKey}
            onChange={(e) =>
              setSlaEdit((s) => ({ ...s, policyKey: e.target.value }))
            }
          />
          <Input
            className="w-24"
            placeholder="due"
            value={slaEdit.dueHours}
            onChange={(e) =>
              setSlaEdit((s) => ({
                ...s,
                dueHours: Number(e.target.value),
              }))
            }
          />
          <Input
            className="w-24"
            placeholder="soon"
            value={slaEdit.dueSoonHours}
            onChange={(e) =>
              setSlaEdit((s) => ({
                ...s,
                dueSoonHours: Number(e.target.value),
              }))
            }
          />
          <Input
            className="w-24"
            placeholder="escal"
            value={slaEdit.escalationHours}
            onChange={(e) =>
              setSlaEdit((s) => ({
                ...s,
                escalationHours: Number(e.target.value),
              }))
            }
          />

          <Button
            disabled={saving || !slaEdit.policyKey}
            onClick={() =>
              update({
                type: "UPSERT_SLA",
                domainKey: selectedDomain,
                policyKey: slaEdit.policyKey,
                dueHours: slaEdit.dueHours,
                dueSoonHours: slaEdit.dueSoonHours,
                escalationHours: slaEdit.escalationHours,
              })
            }
          >
            Save SLA Policy
          </Button>
        </div>

        <div className="mt-4">
          <div className="overflow-auto rounded-[var(--rg-radius)] border border-[color:var(--rg-border-strong)] bg-[color:var(--rg-panel)]">
            <Table className="min-w-[850px] w-full text-sm">
              <thead className="bg-[color:var(--rg-panel-2)]">
                <tr className="text-left">
                  <th className="p-3 text-[12px] font-semibold text-[color:var(--rg-muted)]">Policy</th>
                  <th className="p-3 text-[12px] font-semibold text-[color:var(--rg-muted)]">Due hours</th>
                  <th className="p-3 text-[12px] font-semibold text-[color:var(--rg-muted)]">Due soon</th>
                  <th className="p-3 text-[12px] font-semibold text-[color:var(--rg-muted)]">Escalation</th>
                </tr>
              </thead>
              <tbody>
                {slaForDomain.map((p) => (
                  <tr key={p.policy_key} className="border-t border-[color:var(--rg-border-strong)] hover:bg-[color:var(--rg-panel-2)] transition">
                    <td className="p-3 font-semibold">{p.policy_key}</td>
                    <td className="p-3">{p.due_hours}</td>
                    <td className="p-3">{p.due_soon_hours}</td>
                    <td className="p-3">{p.escalation_hours}</td>
                  </tr>
                ))}
                {!slaForDomain.length ? (
                  <tr>
                    <td className="p-3 text-[color:var(--rg-muted)]" colSpan={4}>
                      No SLA policies for this domain yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </div>
        </CardBody>
      </Card>
      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="text-lg font-semibold">Signals</div>
        <div className="mt-2 text-sm text-neutral-600">
          Domain signal templates + detectors.
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold">
              Signals in {selectedDomain}
            </div>
            <div className="mt-2 space-y-2">
              {signalsForDomain.map((s) => (
                <Button
                  key={s.signal_key}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedSignal === s.signal_key ? "bg-neutral-50" : "bg-white"
                  }`}
                  onClick={() => pickSignal(s.signal_key)}
                  disabled={saving}
                >
                  <div className="font-semibold">{s.signal_key}</div>
                  <div className="text-xs text-neutral-600">{s.name}</div>
                </Button>
              ))}
              {!signalsForDomain.length ? (
                <div className="text-sm text-neutral-600">No signals yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border p-3 md:col-span-2">
            <div className="text-sm font-semibold">Edit / Create Signal</div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                className="rounded-lg border p-2 text-sm"
                placeholder="signal_key"
                value={signalEdit.signalKey}
                onChange={(e) =>
                  setSignalEdit((s) => ({ ...s, signalKey: e.target.value }))
                }
              />
              <Input
                className="rounded-lg border p-2 text-sm"
                placeholder="name"
                value={signalEdit.name}
                onChange={(e) =>
                  setSignalEdit((s) => ({ ...s, name: e.target.value }))
                }
              />
              <Input
                className="rounded-lg border p-2 text-sm md:col-span-2"
                placeholder="description"
                value={signalEdit.description}
                onChange={(e) =>
                  setSignalEdit((s) => ({
                    ...s,
                    description: e.target.value,
                  }))
                }
              />
              <NativeSelect
                className="rounded-lg border p-2 text-sm"
                value={signalEdit.severity}
                onChange={(e) =>
                  setSignalEdit((s) => ({ ...s, severity: e.target.value }))
                }
              >
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
              <Input
                className="rounded-lg border p-2 text-sm"
                placeholder="default_weight (0.3–3.0)"
                value={signalEdit.defaultWeight}
                onChange={(e) =>
                  setSignalEdit((s) => ({
                    ...s,
                    defaultWeight: Number(e.target.value),
                  }))
                }
              />

              <div className="md:col-span-2">
                <div className="mb-1 text-xs text-neutral-600">
                  Detector JSON (keywords[], regex)
                </div>
                <Textarea
                  className="h-40 w-full rounded-lg border p-2 font-mono text-xs"
                  value={signalEdit.detectorText}
                  onChange={(e) =>
                    setSignalEdit((s) => ({
                      ...s,
                      detectorText: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button
                  className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold"
                  disabled={
                    saving || !signalEdit.signalKey || !signalEdit.name
                  }
                  onClick={() => {
                    let detector: Record<string, unknown> = {};
                    try {
                      detector =
                        JSON.parse(signalEdit.detectorText || "{}") ?? {};
                    } catch {
                      detector = {};
                    }
                    update({
                      type: "UPSERT_SIGNAL",
                      domainKey: selectedDomain,
                      signalKey: signalEdit.signalKey,
                      name: signalEdit.name,
                      description: signalEdit.description || null,
                      severity: signalEdit.severity,
                      defaultWeight: signalEdit.defaultWeight,
                      detector,
                    });
                  }}
                >
                  Save Signal
                </Button>

                {selectedSignal ? (
                  <Button
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                    disabled={saving}
                    onClick={() =>
                      update({
                        type: "DELETE_SIGNAL",
                        domainKey: selectedDomain,
                        signalKey: selectedSignal,
                      })
                    }
                  >
                    Delete Signal
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="text-sm font-semibold">
                Mitigations for {selectedSignal || "—"}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input
                  className="rounded-lg border p-2 text-sm"
                  placeholder="mitigation_key"
                  value={mitEdit.mitigationKey}
                  onChange={(e) =>
                    setMitEdit((s) => ({
                      ...s,
                      mitigationKey: e.target.value,
                    }))
                  }
                />
                <NativeSelect
                  className="rounded-lg border p-2 text-sm"
                  value={mitEdit.severity}
                  onChange={(e) =>
                    setMitEdit((s) => ({ ...s, severity: e.target.value }))
                  }
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold"
                  disabled={
                    saving ||
                    !selectedSignal ||
                    !mitEdit.mitigationKey ||
                    !mitEdit.recommendation
                  }
                  onClick={() =>
                    update({
                      type: "UPSERT_MITIGATION",
                      domainKey: selectedDomain,
                      signalKey: selectedSignal,
                      mitigationKey: mitEdit.mitigationKey,
                      recommendation: mitEdit.recommendation,
                      severity: mitEdit.severity,
                    })
                  }
                >
                  Save Mitigation
                </Button>

                <Textarea
                  className="h-24 w-full rounded-lg border p-2 text-sm md:col-span-3"
                  placeholder="recommendation"
                  value={mitEdit.recommendation}
                  onChange={(e) =>
                    setMitEdit((s) => ({
                      ...s,
                      recommendation: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-3 overflow-auto rounded-xl border">
                <Table className="min-w-[850px] w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr className="text-left">
                      <th className="p-3">Key</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Recommendation</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mitsForSignal.map((m) => (
                      <tr key={m.mitigation_key} className="border-t">
                        <td className="p-3 font-semibold">{m.mitigation_key}</td>
                        <td className="p-3">{m.severity}</td>
                        <td className="p-3">{m.recommendation}</td>
                        <td className="p-3">
                          <Button
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                            disabled={saving}
                            onClick={() =>
                              update({
                                type: "DELETE_MITIGATION",
                                domainKey: selectedDomain,
                                signalKey: selectedSignal,
                                mitigationKey: m.mitigation_key,
                              })
                            }
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!mitsForSignal.length ? (
                      <tr>
                        <td
                          className="p-3 text-neutral-600"
                          colSpan={4}
                        >
                          No mitigations for this signal yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="text-xs text-neutral-500">
        Note: Admin access requires organization_members.role = &quot;admin&quot;.
      </div>
    </div>
  );
}
