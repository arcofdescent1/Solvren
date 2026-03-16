"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Card, CardBody } from "@/ui";
import { JiraProjectSelector } from "./JiraProjectSelector";
import { JiraStatusMappingTable } from "./JiraStatusMappingTable";
import { JiraFeatureTogglePanel } from "./JiraFeatureTogglePanel";
import { JiraValidationChecklist } from "./JiraValidationChecklist";
import { JiraCompletionScreen } from "./JiraCompletionScreen";
import { trackIntegrationSetup } from "@/lib/integrationAnalytics";

type JiraConfig = {
  cloudId?: string;
  siteUrl?: string;
  siteName?: string;
  projects?: string[];
  statusMappings?: Record<string, string>;
  features?: { webhookSync?: boolean; issuePropertySync?: boolean; commentSync?: boolean };
};

type Props = {
  orgId: string;
  config: JiraConfig | null;
  connected: boolean;
  isAdmin: boolean;
  initialStep?: string;
};

export function JiraSetupWizard({ orgId, config, connected, isAdmin, initialStep }: Props) {
  const [step, setStep] = useState(initialStep ?? "connect");
  const [configState, setConfigState] = useState<JiraConfig>(config ?? {});

  useEffect(() => {
    if (step === "connect" && !connected && isAdmin) {
      trackIntegrationSetup("jira_setup_started", { orgId });
    }
  }, [step, connected, isAdmin, orgId]);

  const saveConfig = async (partial: Partial<JiraConfig>) => {
    const res = await fetch(`/api/integrations/jira/config?orgId=${encodeURIComponent(orgId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed");
    setConfigState((c) => ({ ...c, ...partial }));
    if (partial.projects) trackIntegrationSetup("jira_setup_project_selected", { orgId, count: partial.projects.length });
    if (partial.statusMappings) trackIntegrationSetup("jira_setup_status_mapping_saved", { orgId });
    if (partial.features) trackIntegrationSetup("jira_setup_features_saved", { orgId, ...partial.features });
  };

  const handleConnect = async () => {
    trackIntegrationSetup("jira_setup_connect_clicked", { orgId });
    const res = await fetch("/api/integrations/jira/oauth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, returnTo: "setup" }),
    });
    const json = await res.json();
    const url = (json as { authorizeUrl?: string }).authorizeUrl;
    if (url) window.location.href = url;
    else throw new Error("No authorize URL");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-sm">
        <span className={step === "connect" ? "font-medium text-[var(--primary)]" : "text-[var(--text-muted)]"}>Connect</span>
        <span className="text-[var(--text-muted)]">→</span>
        <span className={step === "projects" ? "font-medium text-[var(--primary)]" : "text-[var(--text-muted)]"}>Projects</span>
        <span className="text-[var(--text-muted)]">→</span>
        <span className={step === "statuses" ? "font-medium text-[var(--primary)]" : "text-[var(--text-muted)]"}>Status mapping</span>
        <span className="text-[var(--text-muted)]">→</span>
        <span className={step === "features" ? "font-medium text-[var(--primary)]" : "text-[var(--text-muted)]"}>Features</span>
        <span className="text-[var(--text-muted)]">→</span>
        <span className={step === "validate" || step === "complete" ? "font-medium text-[var(--primary)]" : "text-[var(--text-muted)]"}>Validate</span>
      </div>

      {step === "connect" && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-lg">Connect Jira</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Connect Jira to read issues, monitor approvals, and sync governance.
            </p>
            {connected ? (
              <>
                <div className="rounded border p-3 text-sm">
                  <p className="font-medium text-green-600">Connected</p>
                  <p className="text-[var(--text-muted)]">{config?.siteUrl ?? config?.siteName ?? "Jira Cloud"}</p>
                </div>
                <Button onClick={() => setStep("projects")}>Continue</Button>
              </>
            ) : isAdmin ? (
              <Button onClick={handleConnect} className="bg-[#0052CC] hover:bg-[#0747A6] text-white">
                Connect Jira
              </Button>
            ) : (
              <p className="text-sm">Only admins can connect.</p>
            )}
            <Link href="/org/settings/integrations/jira" className="block text-sm text-[var(--primary)]">← Back</Link>
          </CardBody>
        </Card>
      )}

      {step === "projects" && connected && (
        <JiraProjectSelector
          orgId={orgId}
          selectedKeys={configState.projects ?? []}
          onSave={async (keys) => saveConfig({ projects: keys })}
          onNext={() => setStep("statuses")}
        />
      )}

      {step === "statuses" && connected && (
        <JiraStatusMappingTable
          orgId={orgId}
          initialMappings={configState.statusMappings ?? {}}
          onSave={async (m) => saveConfig({ statusMappings: m })}
          onNext={() => setStep("features")}
        />
      )}

      {step === "features" && connected && (
        <JiraFeatureTogglePanel
          initialFeatures={configState.features ?? {}}
          onSave={async (f) => saveConfig({ features: f })}
          onNext={() => setStep("validate")}
        />
      )}

      {step === "validate" && connected && (
        <JiraValidationChecklist
          orgId={orgId}
          onSuccess={() => {
            trackIntegrationSetup("jira_setup_completed", { orgId });
            setStep("complete");
          }}
        />
      )}

      {step === "complete" && (
        <JiraCompletionScreen
          siteUrl={configState.siteUrl ?? configState.siteName ?? ""}
          projects={configState.projects ?? []}
          features={configState.features ?? {}}
        />
      )}
    </div>
  );
}
