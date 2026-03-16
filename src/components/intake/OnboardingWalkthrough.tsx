"use client";

import { useState, useEffect } from "react";
import { Card, CardBody } from "@/ui";
import { Button } from "@/ui/primitives/button";

const STORAGE_KEY = "solvren_onboarding_walkthrough_seen";

const STEPS = [
  "What Solvren does — Govern revenue-impacting changes so nothing ships without the right approval.",
  "Detecting revenue risk — We monitor Jira and other systems for pricing, billing, and contract changes.",
  "Creating a change request — This wizard walks you through what’s changing, impact, evidence, and who approves.",
  "Approving change — Approvers get notified and can approve or request changes.",
  "Investigating risk — When we detect risk, you can link it to a change or create one from here.",
];

export function OnboardingWalkthrough() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!localStorage.getItem(STORAGE_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Card className="border-[var(--primary)]/30 bg-[var(--bg-muted)]/30">
      <CardBody className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">New to Solvren?</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Quick overview (under 2 min):
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-[var(--text)]">
              {STEPS.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <Button variant="outline" size="sm" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
