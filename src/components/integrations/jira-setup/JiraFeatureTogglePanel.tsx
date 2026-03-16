"use client";

import { useState } from "react";
import { Button, Card, CardBody } from "@/ui";
import { Switch } from "@/ui/primitives/switch";

type Props = {
  initialFeatures: {
    webhookSync?: boolean;
    issuePropertySync?: boolean;
    commentSync?: boolean;
  };
  onSave: (f: { webhookSync: boolean; issuePropertySync: boolean; commentSync: boolean }) => Promise<void>;
  onNext: () => void;
};

export function JiraFeatureTogglePanel({ initialFeatures, onSave, onNext }: Props) {
  const [webhookSync, setWebhookSync] = useState(initialFeatures?.webhookSync ?? true);
  const [issuePropertySync, setIssuePropertySync] = useState(initialFeatures?.issuePropertySync ?? true);
  const [commentSync, setCommentSync] = useState(initialFeatures?.commentSync ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ webhookSync, issuePropertySync, commentSync });
      onNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="font-semibold text-lg">Enable features</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Choose which Jira features to enable.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={webhookSync} onCheckedChange={setWebhookSync} />
            <div>
              <p className="font-medium text-sm">Webhook sync</p>
              <p className="text-xs text-[var(--text-muted)]">Real-time status updates</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={issuePropertySync} onCheckedChange={setIssuePropertySync} />
            <div>
              <p className="font-medium text-sm">Issue property sync</p>
              <p className="text-xs text-[var(--text-muted)]">Governance data in Jira</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={commentSync} onCheckedChange={setCommentSync} />
            <div>
              <p className="font-medium text-sm">Comment sync</p>
              <p className="text-xs text-[var(--text-muted)]">Mirror approvals to Jira</p>
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save and continue"}
        </Button>
      </CardBody>
    </Card>
  );
}
