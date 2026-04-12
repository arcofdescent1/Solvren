"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { RISK_PRIORITY_CATEGORY_KEYS, RISK_PRIORITY_LABELS } from "@/modules/onboarding/phase2/risk-priority-catalog";
import { phase2BasePayload } from "./phase2Analytics";

export function RiskPrioritiesStep(props: {
  orgId: string;
  phase2Status: string | null | undefined;
  currentStepKey: string | null | undefined;
  initialCategories?: string[];
  initialDepartments?: string;
  onRefresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(() => props.initialCategories ?? []);
  const [departments, setDepartments] = useState(props.initialDepartments ?? "");
  const [severity, setSeverity] = useState("medium");
  const [urgency, setUrgency] = useState("immediate");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (props.initialCategories?.length) setSelected(props.initialCategories);
    if (props.initialDepartments) setDepartments(props.initialDepartments);
  }, [props.initialCategories, props.initialDepartments]);

  const deptList = useMemo(
    () =>
      departments
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [departments]
  );

  function toggle(cat: string) {
    setSelected((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      if (prev.length >= 3) return prev;
      return [...prev, cat];
    });
  }

  async function save() {
    setMsg(null);
    if (selected.length < 1 || selected.length > 3) {
      setMsg("Pick 1–3 risk categories.");
      return;
    }
    if (deptList.length < 1) {
      setMsg("Enter at least one department (comma-separated).");
      return;
    }
    setLoading(true);
    try {
      const priorities = selected.map((category, i) => ({
        category,
        priorityRank: i + 1,
        departments: deptList,
        severityThreshold: severity,
        notificationUrgency: urgency,
      }));
      const res = await fetch("/api/onboarding/phase2/risk-priorities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priorities }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Save failed");
        return;
      }
      trackAppEvent("onboarding_phase2_risk_priorities_saved", phase2BasePayload(props.orgId, props.phase2Status, props.currentStepKey));
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
            <h2 className="text-lg font-semibold">Risk priorities</h2>
            <p className="text-sm text-[var(--text-muted)]">Choose up to three operational risk themes and who they touch. This steers recommendations and alert prioritization.</p>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Risk categories (1–3)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {RISK_PRIORITY_CATEGORY_KEYS.map((key) => {
                const on = selected.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      on ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] text-[var(--text-muted)]"
                    }`}
                  >
                    {RISK_PRIORITY_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="p2-dept" className="mb-1 block text-sm font-medium">
              Departments (comma-separated)
            </label>
            <Input id="p2-dept" value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder="Sales, RevOps" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="p2-sev" className="mb-1 block text-sm font-medium">
                Severity tolerance
              </label>
              <Input id="p2-sev" value={severity} onChange={(e) => setSeverity(e.target.value)} />
            </div>
            <div>
              <label htmlFor="p2-urg" className="mb-1 block text-sm font-medium">
                Notification urgency
              </label>
              <Input id="p2-urg" value={urgency} onChange={(e) => setUrgency(e.target.value)} />
            </div>
          </div>
          {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
          <Button type="button" onClick={() => void save()} disabled={loading}>
            {loading ? "Saving…" : "Save & continue"}
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}
