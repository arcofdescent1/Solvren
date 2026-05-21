"use client";

import Link from "next/link";
import { Badge, Button, Container } from "@/ui";

export function Phase4EnterpriseBanner(props: {
  phase4Status: string | null;
  cadenceReminder: boolean;
  executiveStreak: number;
  executiveTarget: number;
}) {
  const { phase4Status, cadenceReminder, executiveStreak, executiveTarget } = props;
  if (phase4Status === "COMPLETED" || phase4Status === "SKIPPED") return null;

  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
      <Container className="py-3">
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant={cadenceReminder ? "warning" : "success"}>
              {cadenceReminder ? "Needs cadence" : "Expansion ready"}
            </Badge>
            <p className="text-sm text-[var(--text)]">
              <span className="font-semibold">Enterprise expansion and renewal readiness</span>
              {cadenceReminder
                ? ` - executive weekly cadence is below ${executiveTarget} qualifying weeks; current streak is ${executiveStreak}.`
                : " - grow footprint, deepen integrations, and reinforce renewal proof."}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/onboarding/enterprise">Open expansion center</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
