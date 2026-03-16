"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Card, CardBody } from "@/ui";
import { trackIntegrationSetup } from "@/lib/integrationAnalytics";

type Props = {
  orgId: string;
  connected: boolean;
  isAdmin: boolean;
  config: { objects?: { objectType: string; enabled?: boolean }[] } | null;
  initialStep?: string;
};

const STEPS = ["connect", "objects", "field-risk", "rules", "validate", "complete"] as const;
type Step = (typeof STEPS)[number];

const DEFAULT_OBJECTS = [
  { name: "deals", label: "Deals" },
  { name: "quotes", label: "Quotes" },
  { name: "products", label: "Products" },
  { name: "contacts", label: "Contacts" },
  { name: "companies", label: "Companies" },
];

export function HubSpotSetupWizard(props: Props) {
  const { orgId, connected, isAdmin, config, initialStep } = props;
  const [step, setStep] = useState<Step>((initialStep as Step) ?? (connected ? "objects" : "connect"));
  const [selectedObjects, setSelectedObjects] = useState<string[]>(
    config?.objects?.filter((o) => o.enabled !== false).map((o) => o.objectType) ?? ["deals", "quotes", "products"]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === "connect" && isAdmin) trackIntegrationSetup("hubspot_connect_started", { orgId });
  }, [step, orgId, isAdmin]);

  const toggleObject = (name: string) => {
    setSelectedObjects((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  };

  const handleSaveObjects = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/hubspot/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          objects: selectedObjects.map((objectType) => ({ objectType, enabled: true })),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      trackIntegrationSetup("hubspot_objects_selected", { orgId, count: selectedObjects.length });
      setStep("field-risk");
    } catch {
      setError("Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRulesNext = () => {
    trackIntegrationSetup("hubspot_rules_created", { orgId });
    setStep("validate");
  };

  const handleValidate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/hubspot/test?orgId=${encodeURIComponent(orgId)}`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok && j.status === "ok") {
        trackIntegrationSetup("hubspot_connect_success", { orgId });
        setStep("complete");
      } else setError(j.error ?? "Validation failed");
    } catch {
      setError("Validation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 pb-2 text-sm">
        {STEPS.map((s) => (
          <span key={s} className={step === s ? "font-medium text-[var(--primary)]" : "text-[var(--text-muted)]"}>
            {s}
          </span>
        ))}
      </div>

      {step === "connect" && (
        <Card>
          <CardBody>
            <h3 className="font-semibold text-lg">Step 1 — Connect HubSpot</h3>
            <p className="text-sm text-[var(--text-muted)]">Connect via OAuth or private app on the integration page.</p>
            {connected ? (
              <Button onClick={() => setStep("objects")}>Continue</Button>
            ) : (
              <Link href="/org/settings/integrations/hubspot"><Button>Go to HubSpot</Button></Link>
            )}
            <Link href="/org/settings/integrations/hubspot" className="block text-sm text-[var(--primary)]">← Back</Link>
          </CardBody>
        </Card>
      )}

      {step === "objects" && connected && (
        <Card>
          <CardBody>
            <h3 className="font-semibold text-lg">Step 2 — Select objects</h3>
            <div className="space-y-2 my-4">
              {DEFAULT_OBJECTS.map((o) => (
                <label key={o.name} className="flex cursor-pointer gap-2">
                  <input type="checkbox" checked={selectedObjects.includes(o.name)} onChange={() => toggleObject(o.name)} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-sm text-amber-600">{error}</p>}
            <Button onClick={handleSaveObjects} disabled={loading || selectedObjects.length === 0}>Save and continue</Button>
          </CardBody>
        </Card>
      )}

      {step === "field-risk" && (
        <Card><CardBody>
          <h3 className="font-semibold text-lg">Step 3 — Property risk mapping</h3>
          <Button onClick={() => setStep("rules")}>Continue</Button>
        </CardBody></Card>
      )}

      {step === "rules" && (
        <Card><CardBody>
          <h3 className="font-semibold text-lg">Step 4 — Governance rules</h3>
          <Button onClick={handleRulesNext}>Continue</Button>
        </CardBody></Card>
      )}

      {step === "validate" && (
        <Card><CardBody>
          <h3 className="font-semibold text-lg">Step 5 — Validation</h3>
          {error && <p className="text-sm text-amber-600">{error}</p>}
          <Button onClick={handleValidate} disabled={loading}>Test connection</Button>
        </CardBody></Card>
      )}

      {step === "complete" && (
        <Card><CardBody>
          <h3 className="font-semibold text-lg text-green-600">HubSpot setup complete</h3>
          <p className="text-sm text-[var(--text-muted)]">Monitoring {selectedObjects.length} object(s).</p>
          <Link href="/org/settings/integrations/hubspot"><Button>Go to HubSpot</Button></Link>
        </CardBody></Card>
      )}
    </div>
  );
}
