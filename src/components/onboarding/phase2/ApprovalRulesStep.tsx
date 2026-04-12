"use client";

import { useState } from "react";
import { Button, Card, CardBody, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { ACTIVATION_POLICY_TEMPLATES, type ActivationPolicyTemplateKey } from "@/modules/onboarding/phase2/policy-templates";
import { phase2BasePayload } from "./phase2Analytics";

const TEMPLATE_LIST = Object.keys(ACTIVATION_POLICY_TEMPLATES) as ActivationPolicyTemplateKey[];

export function ApprovalRulesStep(props: {
  orgId: string;
  phase2Status: string | null | undefined;
  currentStepKey: string | null | undefined;
  onRefresh: () => Promise<void>;
}) {
  const [picked, setPicked] = useState<ActivationPolicyTemplateKey[]>(["revenue_impact_requires_director_approval"]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(k: ActivationPolicyTemplateKey) {
    setPicked((prev) => {
      if (prev.includes(k)) return prev.filter((x) => x !== k);
      if (prev.length >= 3) return prev;
      return [...prev, k];
    });
  }

  async function save() {
    setMsg(null);
    if (picked.length < 1) {
      setMsg("Select at least one starter rule.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/phase2/approval-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: picked }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Save failed");
        return;
      }
      trackAppEvent("onboarding_phase2_approval_rule_created", phase2BasePayload(props.orgId, props.phase2Status, props.currentStepKey));
      await props.onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <Stack gap={4}>
          <div>
            <h2 className="text-lg font-semibold">Approval rules</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Create real governance policies (stored in Policy Center). Pick 1–3 starters — you can refine them later.
            </p>
          </div>
          {TEMPLATE_LIST.map((k) => {
            const tpl = ACTIVATION_POLICY_TEMPLATES[k];
            const on = picked.includes(k);
            return (
              <label key={k} className="flex cursor-pointer gap-3 rounded-md border border-[var(--border)] p-3">
                <input type="checkbox" checked={on} onChange={() => toggle(k)} />
                <div>
                  <p className="font-medium">{tpl.displayName}</p>
                  <p className="text-sm text-[var(--text-muted)]">{tpl.description}</p>
                </div>
              </label>
            );
          })}
          {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
          <Button type="button" onClick={() => void save()} disabled={loading}>
            {loading ? "Saving…" : "Save policies & continue"}
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}
