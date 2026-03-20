"use client";

/**
 * Phase 10 — Activation recommendations panel (§19.4).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/ui/primitives/badge";
import { Card, CardBody } from "@/ui/primitives/card";

type Rec = {
  recommendationType: string;
  targetKey: string;
  title: string;
  description: string;
  confidenceScore: number;
  href?: string;
};

export function ActivationRecommendationsPanel() {
  const [recommendations, setRecommendations] = useState<Rec[]>([]);

  const fetchRecs = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/recommendations");
      if (res.ok) {
        const d = await res.json();
        setRecommendations(d.recommendations ?? []);
      }
    } catch {
      setRecommendations([]);
    }
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  if (recommendations.length === 0) return null;

  return (
    <Card>
      <CardBody>
        <h3 className="mb-3 text-sm font-semibold text-[color:var(--rg-text)]">Recommended next steps</h3>
        <ul className="space-y-3">
          {recommendations.slice(0, 5).map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {r.href ? (
                    <Link href={r.href} className="hover:underline text-[color:var(--rg-primary)]">
                      {r.title}
                    </Link>
                  ) : (
                    r.title
                  )}
                </p>
                <p className="text-xs text-[color:var(--rg-text-muted)]">{r.description}</p>
              </div>
              <Badge variant="secondary">{r.confidenceScore}</Badge>
            </li>
          ))}
        </ul>
        <Link
          href="/onboarding"
          className="mt-3 inline-block text-xs font-medium text-[color:var(--rg-primary)] hover:underline"
        >
          View all recommendations →
        </Link>
      </CardBody>
    </Card>
  );
}
