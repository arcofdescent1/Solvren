"use client";

import { useState } from "react";
import { Button, Input, Card, CardBody, Stack } from "@/ui";
import { Switch } from "@/ui/primitives/switch";

type JiraConfig = {
  cloudId?: string;
  siteUrl?: string;
  siteName?: string;
  enabled?: boolean;
  projects?: string[];
  issueTypes?: string[];
  fieldMappings?: Record<string, string>;
  statusMappings?: Record<string, string>;
  features?: {
    webhookSync?: boolean;
    issuePropertySync?: boolean;
    commentSync?: boolean;
    workflowBlocking?: boolean;
  };
};

type Props = {
  orgId: string;
  initialConfig: JiraConfig | null;
  onSaved: () => void;
  onCancel: () => void;
};

const DEFAULT_STATUS_MAPPINGS: Record<string, string> = {
  "To Do": "DRAFT",
  "In Progress": "DRAFT",
  "Ready for Review": "READY",
  "In Review": "IN_REVIEW",
  "Done": "APPROVED",
  "Rejected": "REJECTED",
};

export default function JiraConfigForm({
  orgId,
  initialConfig,
  onSaved,
  onCancel,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true);
  const [projectsStr, setProjectsStr] = useState(
    (initialConfig?.projects ?? []).join(", ")
  );
  const [issueTypesStr, setIssueTypesStr] = useState(
    (initialConfig?.issueTypes ?? ["Story", "Task", "Bug"]).join(", ")
  );
  const [fieldDomain, setFieldDomain] = useState(
    initialConfig?.fieldMappings?.domain ?? ""
  );
  const [fieldSystems, setFieldSystems] = useState(
    initialConfig?.fieldMappings?.systems ?? ""
  );
  const [fieldChangeType, setFieldChangeType] = useState(
    initialConfig?.fieldMappings?.changeType ?? ""
  );
  const [statusMappings, setStatusMappings] = useState<Record<string, string>>(
    { ...DEFAULT_STATUS_MAPPINGS, ...(initialConfig?.statusMappings ?? {}) }
  );
  const [webhookSync, setWebhookSync] = useState(
    initialConfig?.features?.webhookSync ?? false
  );
  const [issuePropertySync, setIssuePropertySync] = useState(
    initialConfig?.features?.issuePropertySync ?? false
  );
  const [commentSync, setCommentSync] = useState(
    initialConfig?.features?.commentSync ?? false
  );
  const [workflowBlocking, setWorkflowBlocking] = useState(
    initialConfig?.features?.workflowBlocking ?? false
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    const projects = projectsStr
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (projects.length === 0) {
      setError("At least one project key is required");
      setSaving(false);
      return;
    }
    const issueTypes = issueTypesStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      enabled,
      projects,
      issueTypes: issueTypes.length > 0 ? issueTypes : ["Story", "Task", "Bug"],
      fieldMappings: {
        ...(fieldDomain && { domain: fieldDomain }),
        ...(fieldSystems && { systems: fieldSystems }),
        ...(fieldChangeType && { changeType: fieldChangeType }),
      },
      statusMappings,
      features: {
        webhookSync,
        issuePropertySync,
        commentSync,
        workflowBlocking,
      },
    };

    try {
      const res = await fetch(
        `/api/integrations/jira/config?orgId=${encodeURIComponent(orgId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (json as { error?: string }).error ??
            (json as { details?: string[] }).details?.join(", ") ??
            "Failed to save"
        );
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardBody className="space-y-4">
        <h4 className="font-medium">Jira configuration</h4>

        {initialConfig?.siteUrl && (
          <div>
            <label className="text-xs text-[var(--text-muted)]">Site URL</label>
            <Input value={initialConfig.siteUrl} readOnly className="bg-[var(--bg-surface-2)]" />
          </div>
        )}
        {initialConfig?.cloudId && (
          <div>
            <label className="text-xs text-[var(--text-muted)]">Cloud ID</label>
            <Input value={initialConfig.cloudId} readOnly className="bg-[var(--bg-surface-2)]" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <label className="text-sm">Integration enabled</label>
        </div>

        <div>
          <label className="text-xs text-[var(--text-muted)]">Projects (comma-separated keys)</label>
          <Input
            value={projectsStr}
            onChange={(e) => setProjectsStr(e.target.value)}
            placeholder="ENG, PLATFORM"
          />
        </div>

        <div>
          <label className="text-xs text-[var(--text-muted)]">Issue types (comma-separated)</label>
          <Input
            value={issueTypesStr}
            onChange={(e) => setIssueTypesStr(e.target.value)}
            placeholder="Story, Task, Bug"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Field mappings (Jira custom field IDs)</label>
          <Stack gap={2} className="mt-1">
            <div>
              <label className="text-xs text-[var(--text-muted)]">Domain</label>
              <Input
                value={fieldDomain}
                onChange={(e) => setFieldDomain(e.target.value)}
                placeholder="customfield_10321"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)]">Systems</label>
              <Input
                value={fieldSystems}
                onChange={(e) => setFieldSystems(e.target.value)}
                placeholder="customfield_10322"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)]">Change type</label>
              <Input
                value={fieldChangeType}
                onChange={(e) => setFieldChangeType(e.target.value)}
                placeholder="customfield_10323"
              />
            </div>
          </Stack>
        </div>

        <div>
          <label className="text-sm font-medium">Feature toggles</label>
          <Stack gap={2} className="mt-2">
            <div className="flex items-center gap-2">
              <Switch checked={webhookSync} onCheckedChange={setWebhookSync} />
              <label className="text-sm">Webhook sync</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={issuePropertySync} onCheckedChange={setIssuePropertySync} />
              <label className="text-sm">Issue property sync (governance status in Jira)</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={commentSync} onCheckedChange={setCommentSync} />
              <label className="text-sm">Comment sync</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={workflowBlocking} onCheckedChange={setWorkflowBlocking} />
              <label className="text-sm">Workflow blocking</label>
            </div>
          </Stack>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
