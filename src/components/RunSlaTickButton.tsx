"use client";

import { Button } from "@/ui";

import { useState } from "react";

export default function RunSlaTickButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/trigger-sla-tick", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string })?.error ?? "Tick failed");
      const { scanned = 0, transitioned = 0, errors = 0 } = json as {
        scanned?: number;
        transitioned?: number;
        errors?: number;
      };
      setMsg(
        `Scanned ${scanned}, transitioned ${transitioned}${errors ? `, errors ${errors}` : ""}`
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Tick failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        className="px-3 py-1.5 rounded border text-sm"
        onClick={run}
        disabled={loading}
      >
        {loading ? "Running…" : "Run SLA tick"}
      </Button>
      {msg && <span className="text-xs opacity-70">{msg}</span>}
    </div>
  );
}
