"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { WORKFLOW_CARD_COPY, WORKFLOW_SOURCE_TEMPLATE_KEYS, type WorkflowSourceTemplateKey } from "@/modules/onboarding/phase2/workflow-templates";
import { phase2BasePayload } from "./phase2Analytics";
import { postPhase3Interaction } from "@/components/onboarding/phase3/postPhase3Interaction";

type SlackInfo = { connected: boolean; teamId: string | null; teamName: string | null };

export function WorkflowAlertsStep(props: {
  orgId: string;
  phase2Status: string | null | undefined;
  currentStepKey: string | null | undefined;
  workflowStates: Record<string, { enabled: boolean; detectorKey: string }>;
  slack: SlackInfo;
  initialChannelId: string;
  onRefresh: () => Promise<void>;
}) {
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const k of WORKFLOW_SOURCE_TEMPLATE_KEYS) {
      init[k] = Boolean(props.workflowStates[k]?.enabled);
    }
    return init;
  });
  const [channelId, setChannelId] = useState(props.initialChannelId);
  const [emailDest, setEmailDest] = useState("");
  const [inApp, setInApp] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingWf, setLoadingWf] = useState(false);
  const [loadingNx, setLoadingNx] = useState(false);

  const slackDestination = useMemo(() => {
    const tid = props.slack.teamId ?? "";
    if (!tid || !channelId.trim()) return "";
    return `${tid}:${channelId.trim()}`;
  }, [props.slack.teamId, channelId]);

  async function saveWorkflows() {
    setMsg(null);
    setLoadingWf(true);
    try {
      const workflows = WORKFLOW_SOURCE_TEMPLATE_KEYS.map((sourceTemplateKey) => ({
        sourceTemplateKey,
        enabled: Boolean(toggles[sourceTemplateKey]),
      }));
      const res = await fetch("/api/onboarding/phase2/workflows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflows }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Workflow save failed");
        return;
      }
      trackAppEvent("onboarding_phase2_workflow_enabled", phase2BasePayload(props.orgId, props.phase2Status, props.currentStepKey));
      postPhase3Interaction({ type: "workflow_configured", refType: "activation_workflows", refId: null });
      await props.onRefresh();
    } finally {
      setLoadingWf(false);
    }
  }

  async function saveNotifications() {
    setMsg(null);
    const channels: Array<{ channelType: string; destination: string; enabled: boolean }> = [];
    if (props.slack.connected && slackDestination) {
      channels.push({ channelType: "slack", destination: slackDestination, enabled: true });
    }
    if (emailDest.trim()) {
      channels.push({ channelType: "email", destination: emailDest.trim().toLowerCase(), enabled: true });
    }
    if (inApp) {
      channels.push({ channelType: "in_app", destination: "in_app", enabled: true });
    }
    if (channels.length === 0) {
      setMsg("Add at least one alert destination.");
      return;
    }
    setLoadingNx(true);
    try {
      const res = await fetch("/api/onboarding/phase2/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Notification save failed");
        return;
      }
      trackAppEvent("onboarding_phase2_notification_channel_added", phase2BasePayload(props.orgId, props.phase2Status, props.currentStepKey));
      await props.onRefresh();
    } finally {
      setLoadingNx(false);
    }
  }

  return (
    <Stack gap={4}>
      <Card>
        <CardBody>
          <Stack gap={4}>
            <div>
              <h2 className="text-lg font-semibold">Monitoring workflows</h2>
              <p className="text-sm text-[var(--text-muted)]">Enable the detectors that best match your Phase 1 signals. Each maps to a real Solvren detector configuration.</p>
            </div>
            {WORKFLOW_SOURCE_TEMPLATE_KEYS.map((key) => {
              const copy = WORKFLOW_CARD_COPY[key as WorkflowSourceTemplateKey];
              const on = Boolean(toggles[key]);
              return (
                <div key={key} className="rounded-md border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{copy.title}</p>
                      <p className="text-sm text-[var(--text-muted)]">{copy.description}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Impact: {copy.impact}</p>
                      <p className="text-xs text-[var(--text-muted)]">Default threshold: {copy.defaultThreshold}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setToggles((prev) => ({ ...prev, [key]: !prev[key] }))}
                      />
                      Enable
                    </label>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="secondary" onClick={() => void saveWorkflows()} disabled={loadingWf}>
              {loadingWf ? "Saving…" : "Save workflows"}
            </Button>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Stack gap={4}>
            <div>
              <h2 className="text-lg font-semibold">Alert destinations</h2>
              <p className="text-sm text-[var(--text-muted)]">Route alerts to Slack (recommended), email, and/or in-app.</p>
            </div>
            {!props.slack.connected ? (
              <p className="text-sm">
                Connect Slack to route alerts to a channel.{" "}
                <Link className="font-semibold text-[var(--primary)] hover:underline" href="/org/settings/integrations/slack">
                  Open Slack settings
                </Link>
              </p>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Slack channel ID ({props.slack.teamName ?? "Workspace"} · {props.slack.teamId})
                </label>
                <Input value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="C01234567890" />
                <p className="mt-1 text-xs text-[var(--text-muted)]">Stored as workspace_id:channel_id ({slackDestination || "incomplete"})</p>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Email (optional)</label>
              <Input value={emailDest} onChange={(e) => setEmailDest(e.target.value)} type="email" placeholder="alerts@company.com" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={inApp} onChange={() => setInApp((v) => !v)} />
              In-app notifications
            </label>
            {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
            <Button type="button" onClick={() => void saveNotifications()} disabled={loadingNx}>
              {loadingNx ? "Saving…" : "Save alert routing"}
            </Button>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
