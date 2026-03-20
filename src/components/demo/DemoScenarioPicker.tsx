"use client";

/**
 * Phase 8 — Demo scenario picker.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/ui/primitives/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";

export type DemoScenario = {
  scenarioKey: string;
  displayName: string;
  description: string;
  seedVersion: string;
  metadata?: Record<string, unknown>;
};

export function DemoScenarioPicker() {
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    fetch("/api/demo/scenarios")
      .then((r) => r.json())
      .then((data) => {
        setScenarios(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLaunch = useCallback(
    async (scenarioKey: string) => {
      setLaunching(true);
      try {
        const res = await fetch("/api/demo/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioKey, resetBeforeLaunch: true }),
        });
        if (res.ok) {
          window.location.reload();
        }
      } finally {
        setLaunching(false);
      }
    },
    []
  );

  if (loading || scenarios.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Select
        onValueChange={(v) => {
          if (v) handleLaunch(v);
        }}
        disabled={launching}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Switch scenario" />
        </SelectTrigger>
        <SelectContent>
          {scenarios.map((s) => (
            <SelectItem key={s.scenarioKey} value={s.scenarioKey}>
              {s.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
