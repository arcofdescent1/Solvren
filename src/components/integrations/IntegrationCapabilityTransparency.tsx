"use client";

import { Card, CardBody } from "@/ui";

/**
 * Gap 3 — Capability transparency: what we monitor vs what we don't yet.
 */
export type IntegrationCapabilityTransparencyProps = {
  whatWeMonitor: string[];
  whatWeDoNotMonitor: string[];
};

export function IntegrationCapabilityTransparency({
  whatWeMonitor,
  whatWeDoNotMonitor,
}: IntegrationCapabilityTransparencyProps) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Capability transparency</h3>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            What Solvren monitors
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text)]">
            {whatWeMonitor.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            What Solvren does not yet monitor
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-muted)]">
            {whatWeDoNotMonitor.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
