"use client";

/**
 * Phase 9 — Autonomy controls page (§16.5).
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/ui/primitives/button";
import { Card, CardBody } from "@/ui/primitives/card";
import { Badge } from "@/ui/primitives/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";
import { ExecutionMode } from "@/modules/autonomy-safety/domain";

const MODE_OPTIONS = Object.values(ExecutionMode);
const SCOPE_OPTIONS = ["org", "integration", "action", "playbook", "issue_family", "environment"];

export function AutonomyControlsPage() {
  const [orgMode, setOrgMode] = useState<string>("");
  const [pauses, setPauses] = useState<Array<{ id: string; reason: string; scopeType: string; pauseType: string }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [stateRes, pausesRes] = await Promise.all([
        fetch("/api/autonomy/state"),
        fetch("/api/admin/autonomy/pauses"),
      ]);
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setOrgMode(stateData.requestedMode ?? ExecutionMode.APPROVAL_REQUIRED);
      }
      if (pausesRes.ok) {
        const pausesData = await pausesRes.json();
        setPauses(pausesData.pauses ?? []);
      }
    } catch {
      setPauses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSetMode = async (scopeType: string, scopeRef: string | null, mode: string) => {
    const res = await fetch("/api/admin/autonomy/mode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeType, scopeRef, requestedMode: mode }),
    });
    if (res.ok) {
      setOrgMode(mode);
    }
  };

  const fetchPauses = fetchData;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[color:var(--rg-text)]">Autonomy Controls</h1>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold">Org Default Mode</h2>
          <Select
            value={orgMode || ExecutionMode.APPROVAL_REQUIRED}
            onValueChange={(v) => handleSetMode("org", null, v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold">Active Pause Controls</h2>
          {loading ? (
            <p className="text-sm text-[color:var(--rg-text-muted)]">Loading…</p>
          ) : pauses.length === 0 ? (
            <p className="text-sm text-[color:var(--rg-text-muted)]">No active pauses</p>
          ) : (
            <ul className="space-y-2">
              {pauses.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded border border-[color:var(--rg-border)] px-3 py-2"
                >
                  <div>
                    <Badge variant="warning">{p.pauseType}</Badge>
                    <span className="ml-2 text-sm">{p.reason}</span>
                    <span className="ml-2 text-xs text-[color:var(--rg-text-muted)]">
                      ({p.scopeType})
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await fetch(`/api/admin/autonomy/pause/${p.id}`, { method: "DELETE" });
                      fetchPauses();
                    }}
                  >
                    Clear
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold">Environment Ceilings</h2>
          <p className="text-sm text-[color:var(--rg-text-muted)]">
            demo: SUGGEST_ONLY • sandbox: APPROVAL_REQUIRED • staging: BOUNDED_AUTO • production:
            FULL_AUTO
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
