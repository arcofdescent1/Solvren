"use client";

import Link from "next/link";
import { Badge, Button, Container } from "@/ui";

export function Phase3AdoptionBanner(props: { phase3Status: string | null; eligible: boolean }) {
  const { phase3Status, eligible } = props;
  if (phase3Status === "COMPLETED" || phase3Status === "SKIPPED") return null;

  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
      <Container className="py-3">
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant={eligible ? "success" : "warning"}>{eligible ? "Ready" : "Queued"}</Badge>
            <p className="text-sm text-[var(--text)]">
              <span className="font-semibold">Adoption and executive value</span>
              {!eligible
                ? " - unlocks after enough Phase 2 activity or 7 days since activation."
                : " - embed Solvren across teams and leadership cadence."}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/onboarding/adoption">Continue adoption</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
