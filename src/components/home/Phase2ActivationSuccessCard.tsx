"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, CardBody, Stack } from "@/ui";

export function Phase2ActivationSuccessCard() {
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);

  async function dismiss() {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/phase2/success-card/dismiss", { method: "POST" });
      if (res.ok) setHidden(true);
    } finally {
      setLoading(false);
    }
  }

  if (hidden) return null;

  return (
    <Card className="border-[var(--primary)]/30 bg-[color:color-mix(in_oklab,var(--primary)_8%,white)]">
      <CardBody>
        <Stack gap={3}>
          <div>
            <h2 className="text-lg font-semibold">Solvren is now actively monitoring your organization.</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Your first live workflow, alert routing, and approval policies are running. Explore issues, tune workflows, grow the team, or add integrations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/issues">View Issues</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/readiness">View Workflows</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/org/settings">Manage Team</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/org/settings/integrations">Configure Integrations</Link>
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void dismiss()}>
            {loading ? "Saving…" : "Dismiss"}
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}
