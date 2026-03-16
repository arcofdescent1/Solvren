"use client";

import { Card, CardBody } from "@/ui";

export function WhySolvrenMatters() {
  return (
    <Card className="border-[var(--border)] bg-[var(--bg-muted)]/30">
      <CardBody className="py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Why Solvren matters
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
          Revenue systems change constantly. Pricing updates, contract modifications, and
          billing logic changes can introduce revenue risk. Solvren continuously monitors
          these changes and ensures every revenue-impacting change follows governance and
          approval processes.
        </p>
      </CardBody>
    </Card>
  );
}
