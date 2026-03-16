"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { trackIntegrationSetup } from "@/lib/integrationAnalytics";

type NetSuiteFeatures = {
  revenueImpact?: boolean;
  contractChangeTracking?: boolean;
  financialGovernanceSync?: boolean;
};

type Props = {
  orgId: string;
  connected: boolean;
  isAdmin: boolean;
  initialStep?: string;
};

const steps = ["integration-record", "credentials", "validate", "features", "complete"] as const;
type Step = (typeof steps)[number];

export function NetSuiteSetupWizard({ orgId, connected, isAdmin, initialStep }: Props) {
  const [step, setStep] = useState<Step>(
    (initialStep as Step) ?? (connected ? "validate" : "integration-record")
  );
  const [accountId, setAccountId] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [environment, setEnvironment] = useState<"production" | "sandbox">("sandbox");
  const [features, setFeatures] = useState<NetSuiteFeatures>({
    revenueImpact: true,
    contractChangeTracking: true,
    financialGovernanceSync: false,
  });
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === "integration-record" && isAdmin) {
      trackIntegrationSetup("netsuite_setup_started", { orgId });
    }
  }, [step, orgId, isAdmin]);

  const handleConnect = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/netsuite/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          accountId: accountId.trim(),
          consumerKey: consumerKey.trim(),
          consumerSecret: consumerSecret.trim(),
          environment,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        trackIntegrationSetup("netsuite_setup_credentials_entered", { orgId });
        setStep("validate");
        window.location.reload();
      } else {
        setError(json.error ?? "Failed to connect");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/netsuite/test?orgId=${encodeURIComponent(orgId)}`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok && json.status === "ok") {
        trackIntegrationSetup("netsuite_setup_validated", { orgId });
        setStep("features");
      } else {
        setError(json.error ?? "Validation failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const handleFeaturesNext = () => {
    trackIntegrationSetup("netsuite_setup_completed", { orgId, ...features });
    setStep("complete");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 pb-2 text-sm">
        {steps.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className={step === s ? "font-medium text-[var(--primary)]" : "text-[var(--text-muted)]"}>
              {s === "integration-record" ? "1. Setup" : s === "credentials" ? "2. Credentials" : s === "validate" ? "3. Validate" : s === "features" ? "4. Features" : "5. Done"}
            </span>
            {i < steps.length - 1 && <span className="text-[var(--text-muted)]">→</span>}
          </span>
        ))}
      </div>

      {step === "integration-record" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 1 — Create NetSuite integration record</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Create a NetSuite Integration Record and enable Token-Based Authentication (or OAuth 2.0).
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Go to <strong>Setup → Integration → Manage Integrations</strong></li>
              <li>Click <strong>New</strong></li>
              <li>Name the integration: <strong>Solvren</strong></li>
              <li>Enable <strong>Token-Based Authentication</strong> or OAuth 2.0</li>
              <li>Save the record</li>
              <li>Copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong></li>
            </ol>
            <p className="text-xs text-[var(--text-muted)]">
              NetSuite may refer to these as Client ID and Client Secret in the OAuth 2.0 flow.
            </p>
            <Button onClick={() => setStep("credentials")}>Continue</Button>
            <Link href="/org/settings/integrations/netsuite" className="block text-sm text-[var(--primary)]">← Back</Link>
          </CardBody>
        </Card>
      )}

      {step === "credentials" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 2 & 3 — Enter credentials</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Paste the credentials from your NetSuite integration record.
            </p>
            <Stack gap={3}>
              <div>
                <label className="text-xs text-[var(--text-muted)]">NetSuite Account ID</label>
                <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="1234567_SB1" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Environment</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as "production" | "sandbox")}
                  className="h-10 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Consumer Key / Client ID</label>
                <Input
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="From integration record"
                  type="password"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Consumer Secret / Client Secret</label>
                <Input
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  placeholder="From integration record"
                  type="password"
                  autoComplete="off"
                />
              </div>
            </Stack>
            {error && <p className="text-sm text-amber-600">{error}</p>}
            <Button
              onClick={handleConnect}
              disabled={saving || !accountId.trim() || !consumerKey.trim() || !consumerSecret.trim()}
            >
              {saving ? "Connecting…" : "Connect NetSuite"}
            </Button>
            <Link href="/org/settings/integrations/netsuite" className="block text-sm text-[var(--primary)]">← Back</Link>
          </CardBody>
        </Card>
      )}

      {step === "validate" && connected && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 4 — Validate connection</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Test the connection to confirm authentication and account access.
            </p>
            {error && <p className="text-sm text-amber-600">{error}</p>}
            <Button onClick={handleValidate} disabled={validating}>
              {validating ? "Validating…" : "Test connection"}
            </Button>
            <Link href="/org/settings/integrations/netsuite" className="block text-sm text-[var(--primary)]">← Back</Link>
          </CardBody>
        </Card>
      )}

      {step === "features" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Step 5 — Enable features</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Choose which NetSuite monitoring capabilities to enable.
            </p>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={features.revenueImpact ?? true}
                  onChange={(e) => setFeatures((f) => ({ ...f, revenueImpact: e.target.checked }))}
                />
                <span>Revenue Impact Detection — Monitor pricing or billing changes</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={features.contractChangeTracking ?? true}
                  onChange={(e) => setFeatures((f) => ({ ...f, contractChangeTracking: e.target.checked }))}
                />
                <span>Contract Change Tracking — Detect modifications to sales orders</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={features.financialGovernanceSync ?? false}
                  onChange={(e) => setFeatures((f) => ({ ...f, financialGovernanceSync: e.target.checked }))}
                />
                <span>Financial Governance Sync — Attach governance metadata to transactions</span>
              </label>
            </div>
            <Button onClick={handleFeaturesNext}>Complete setup</Button>
          </CardBody>
        </Card>
      )}

      {step === "complete" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg text-green-600">NetSuite connected</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Solvren is now connected to your NetSuite account. You can monitor revenue-impact changes and financial governance.
            </p>
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">Next steps</p>
              <ul className="mt-2 list-inside list-disc text-[var(--text-muted)]">
                <li>View sync health on the NetSuite integration page</li>
                <li>Enable validation templates if needed</li>
              </ul>
            </div>
            <Link href="/org/settings/integrations/netsuite">
              <Button>Go to NetSuite integration</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
