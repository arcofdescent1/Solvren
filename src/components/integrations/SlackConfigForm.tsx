"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { Switch } from "@/ui/primitives/switch";

type SlackConfig = {
  enabled?: boolean;
  features?: {
    approvalMessages?: boolean;
    riskAlerts?: boolean;
    approvalDMs?: boolean;
    channelAlerts?: boolean;
    slashCommands?: boolean;
    interactiveActions?: boolean;
  };
  routing?: {
    approvalChannelId?: string | null;
    riskAlertChannelId?: string | null;
    incidentChannelId?: string | null;
  };
  messagePolicy?: {
    sendApprovalDMFirst?: boolean;
    fallbackToApprovalChannel?: boolean;
    broadcastHighRiskToChannel?: boolean;
  };
};

type Props = {
  orgId: string;
  initialConfig: SlackConfig | null;
  onSaved: () => void;
  onCancel: () => void;
};

export default function SlackConfigForm({
  orgId,
  initialConfig,
  onSaved,
  onCancel,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true);
  const [approvalMessages, setApprovalMessages] = useState(
    initialConfig?.features?.approvalMessages ?? true
  );
  const [riskAlerts, setRiskAlerts] = useState(
    initialConfig?.features?.riskAlerts ?? true
  );
  const [approvalDMs, setApprovalDMs] = useState(
    initialConfig?.features?.approvalDMs ?? true
  );
  const [channelAlerts, setChannelAlerts] = useState(
    initialConfig?.features?.channelAlerts ?? true
  );
  const [slashCommands, setSlashCommands] = useState(
    initialConfig?.features?.slashCommands ?? true
  );
  const [interactiveActions, setInteractiveActions] = useState(
    initialConfig?.features?.interactiveActions ?? true
  );
  const [approvalChannelId, setApprovalChannelId] = useState(
    initialConfig?.routing?.approvalChannelId ?? ""
  );
  const [riskAlertChannelId, setRiskAlertChannelId] = useState(
    initialConfig?.routing?.riskAlertChannelId ?? ""
  );
  const [incidentChannelId, setIncidentChannelId] = useState(
    initialConfig?.routing?.incidentChannelId ?? ""
  );
  const [sendApprovalDMFirst, setSendApprovalDMFirst] = useState(
    initialConfig?.messagePolicy?.sendApprovalDMFirst ?? true
  );
  const [fallbackToApprovalChannel, setFallbackToApprovalChannel] = useState(
    initialConfig?.messagePolicy?.fallbackToApprovalChannel ?? true
  );
  const [broadcastHighRiskToChannel, setBroadcastHighRiskToChannel] = useState(
    initialConfig?.messagePolicy?.broadcastHighRiskToChannel ?? true
  );

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload = {
      enabled,
      features: {
        approvalMessages,
        riskAlerts,
        approvalDMs,
        channelAlerts,
        slashCommands,
        interactiveActions,
      },
      routing: {
        approvalChannelId: approvalChannelId.trim() || null,
        riskAlertChannelId: riskAlertChannelId.trim() || null,
        incidentChannelId: incidentChannelId.trim() || null,
      },
      messagePolicy: {
        sendApprovalDMFirst,
        fallbackToApprovalChannel,
        broadcastHighRiskToChannel,
      },
    };

    try {
      const res = await fetch(
        `/api/integrations/slack/config?orgId=${encodeURIComponent(orgId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "Failed to save");
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
        <h4 className="font-medium">Slack configuration</h4>

        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <label className="text-sm">Integration enabled</label>
        </div>

        <div>
          <label className="text-sm font-medium">Feature toggles</label>
          <Stack gap={2} className="mt-2">
            <div className="flex items-center gap-2">
              <Switch checked={approvalMessages} onCheckedChange={setApprovalMessages} />
              <label className="text-sm">Approval messages</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={riskAlerts} onCheckedChange={setRiskAlerts} />
              <label className="text-sm">Risk alerts</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={approvalDMs} onCheckedChange={setApprovalDMs} />
              <label className="text-sm">Approval DMs</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={channelAlerts} onCheckedChange={setChannelAlerts} />
              <label className="text-sm">Channel alerts</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={slashCommands} onCheckedChange={setSlashCommands} />
              <label className="text-sm">Slash commands (/rg)</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={interactiveActions} onCheckedChange={setInteractiveActions} />
              <label className="text-sm">Interactive actions (Approve / Request Changes)</label>
            </div>
          </Stack>
        </div>

        <div>
          <label className="text-sm font-medium">Channel IDs</label>
          <Stack gap={2} className="mt-2">
            <div>
              <label className="text-xs text-[var(--text-muted)]">Approval channel</label>
              <Input
                value={approvalChannelId}
                onChange={(e) => setApprovalChannelId(e.target.value)}
                placeholder="C01234567"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)]">Risk alert channel</label>
              <Input
                value={riskAlertChannelId}
                onChange={(e) => setRiskAlertChannelId(e.target.value)}
                placeholder="C01234567"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)]">Incident channel (optional)</label>
              <Input
                value={incidentChannelId}
                onChange={(e) => setIncidentChannelId(e.target.value)}
                placeholder="C01234567"
              />
            </div>
          </Stack>
        </div>

        <div>
          <label className="text-sm font-medium">Message policy</label>
          <Stack gap={2} className="mt-2">
            <div className="flex items-center gap-2">
              <Switch checked={sendApprovalDMFirst} onCheckedChange={setSendApprovalDMFirst} />
              <label className="text-sm">Send approval DM first</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={fallbackToApprovalChannel} onCheckedChange={setFallbackToApprovalChannel} />
              <label className="text-sm">Fallback to approval channel if DM unavailable</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={broadcastHighRiskToChannel} onCheckedChange={setBroadcastHighRiskToChannel} />
              <label className="text-sm">Broadcast high-risk changes to channel</label>
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
