"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Card, CardBody } from "@/ui";
import { trackIntegrationSetup } from "@/lib/integrationAnalytics";

type Props = {
  orgId: string;
  connected: boolean;
  isAdmin: boolean;
  config: { objects?: { objectApiName: string; enabled?: boolean }[] } | null;
  initialStep?: string;
};

const STEPS = ["connect", "objects", "field-risk", "rules", "validate", "complete"] as const;
type Step = (typeof STEPS)[number];

const DEFAULT_OBJECTS = [
  { name: "Opportunity", label: "Opportunity", recommended: true },
  { name: "Quote", label: "Quote", recommended: true },
  { name: "Contract", label: "Contract", recommended: true },
];

export function SalesforceSetupWizard({ orgId, connected, isAdmin, config, initialStep }: Props) {
  const [step, setStep] = useState<Step>((initialStep as Step) ?? (connected ? "objects" : "connect"));
  const [objects, setObjects] = useState(DEFAULT_OBJECTS);
  const [selectedObjects, setSelectedObjects] = useState<string[]>(
    config?.objects?.filter((o) => o.enabled !== false).map((o) => o.objectApiName) ?? ["Opportunity", "Quote", "Contract"]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === "connect" && isAdmin) trackIntegrationSetup("salesforce_connect_started", { orgId });
  }, [step, orgId, isAdmin]);

  useEffect(() => {
    if (step === "objects" && connected) {
      setLoading(true);
      fetch(`/api/integrations/salesforce/objects?orgId=${encodeURIComponent(orgId)}`)
        .then((r) => r.json())
        .then((d: { objects?: { name: string; label: string; recommended?: boolean }[] }) => {
          if (d.objects?.length)
            setObjects(d.objects.map((o) => ({ name: o.name, label: o.label, recommended: o.recommended ?? false })));
        })
        .finally(() => setLoading(false));
    }
  }, [step, connected, orgId]);

  const toggleObject = (name: string) => {
    setSelectedObjects((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  };

  const handleSaveObjects = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/salesforce/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          objects: selectedObjects.map((objectApiName) => ({ objectApiName, enabled: true })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed");
      }
      trackIntegrationSetup("salesforce_objects_selected", { orgId, count: selectedObjects.length });
      setStep("field-risk");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRulesNext = () => {
    trackIntegrationSetup("salesforce_rules_created", { orgId });
    setStep("validate");
  };

  const handleValidate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/salesforce/test?orgId=${encodeURIComponent(orgId)}`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok && j.status === "ok") {
        trackIntegrationSetup("salesforce_connect_success", { orgId });
        setStep("complete");
      } else setError(j.error ?? "Validation failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  };

  const stepLabels: Record<Step, string> = {
    connect: "1. Connect",
    objects: "2. Objects",
    "field-risk": "3. Fields",
    rules: "4. Rules",
    validate: "5. Validate",
    complete: "6. Done",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 pb-2 text-sm">
        {STEPS.map((s) => (
          <span key={s} className={step === s ? "font-medium text-[var(--primary)]" : "text-[var(--text-muted)]"}>
            {stepLabels[s]}
          </span>
        ))}
      </div>

      {step === "connect" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 1 — Connect Salesforce</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Configure your Salesforce Connected App on the integration page. Use Client ID, Client Secret, and auth mode.
            </p>
            {connected ? (
              <>
                <div className="rounded border border-green-600/50 bg-green-950/30 p-3 text-sm">
                  <p className="font-medium text-green-600">Connected</p>
                </div>
                <Button onClick={() => setStep("objects")}>Continue</Button>
              </>
            ) : (
              <Link href="/org/settings/integrations/salesforce">
                <Button>Go to Salesforce integration</Button>
              </Link>
            )}
            <Link href="/org/settings/integrations/salesforce" className="block text-sm text-[var(--primary)]">← Back</Link>
          </CardBody>
        </Card>
      )}

      {step === "objects" && connected && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 2 — Select objects to monitor</h3>
            <p className="text-sm text-[var(--text-muted)]">Choose which Salesforce objects Solvren will monitor.</p>
            <div className="space-y-2">
              {(loading && objects.length === 3 ? DEFAULT_OBJECTS : objects).slice(0, 15).map((o) => (
                <label key={o.name} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={selectedObjects.includes(o.name)} onChange={() => toggleObject(o.name)} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-sm text-amber-600">{error}</p>}
            <Button onClick={handleSaveObjects} disabled={loading || selectedObjects.length === 0}>
              {loading ? "Saving…" : "Save and continue"}
            </Button>
          </CardBody>
        </Card>
      )}

      {step === "field-risk" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 3 — Field risk mapping</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Field risk mappings are configured on the main Salesforce integration page.
            </p>
            <Button onClick={() => setStep("rules")}>Continue</Button>
          </CardBody>
        </Card>
      )}

      {step === "rules" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 4 — Governance rules</h3>
            <p className="text-sm text-[var(--text-muted)]">Governance rules are configured in domain and approval settings.</p>
            <Button onClick={handleRulesNext}>Continue</Button>
          </CardBody>
        </Card>
      )}

      {step === "validate" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 5 — Validation</h3>
            {error && <p className="text-sm text-amber-600">{error}</p>}
            <Button onClick={handleValidate} disabled={loading}>
              {loading ? "Validating…" : "Test connection"}
            </Button>
          </CardBody>
        </Card>
      )}

      {step === "complete" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg text-green-600">Salesforce setup complete</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Solvren will monitor {selectedObjects.length} object(s) for revenue-impacting changes.
            </p>
            <Link href="/org/settings/integrations/salesforce">
              <Button>Go to Salesforce integration</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
