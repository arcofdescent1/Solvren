"use client";

/**
 * Phase 8 — Demo reset button.
 */
import { useCallback, useState } from "react";
import { Button } from "@/ui/primitives/button";

type Props = {
  scenarioKey: string;
  onReset?: () => void;
};

export function DemoResetButton({ scenarioKey, onReset }: Props) {
  const [resetting, setResetting] = useState(false);

  const handleReset = useCallback(async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioKey, resetMode: "full" }),
      });
      if (res.ok) {
        onReset?.();
        window.location.reload();
      }
    } finally {
      setResetting(false);
    }
  }, [scenarioKey, onReset]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReset}
      disabled={resetting}
    >
      {resetting ? "Resetting…" : "Reset Demo"}
    </Button>
  );
}
