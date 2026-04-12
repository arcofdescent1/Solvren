"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Stack } from "@/ui";
import { EXEC_SUMMARY_METRICS } from "@/modules/onboarding/phase3/phase3-constants";
import { postPhase3Interaction } from "./postPhase3Interaction";

export function ExecutiveVisibilityStep() {
  const [deliveryChannel, setDeliveryChannel] = useState("email");
  const [destination, setDestination] = useState("");
  const [scheduleDay, setScheduleDay] = useState("friday");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [timezone, setTimezone] = useState("UTC");
  const [metrics, setMetrics] = useState<string[]>(["revenue_at_risk", "prevented_incidents", "value_created"]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleMetric = (m: string) => {
    setMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/onboarding/phase3/executive-summary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        deliveryChannel,
        destination,
        scheduleDay,
        scheduleTime,
        timezone,
        metrics,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok) setMsg(j.error ?? "Save failed");
    else {
      setMsg("Executive summary preferences saved. Weekly sends are enqueued by the nightly job for the configured day.");
      postPhase3Interaction({ type: "executive_summary_opened", refType: "preferences_saved", refId: null });
    }
  };

  return (
    <Stack gap={4}>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Invite an executive</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Suggested roles: COO, VP Operations, VP Sales, CFO, Head of RevOps. Use the <strong>Invite more teams</strong> step with
          department <strong>Leadership</strong> and set their title after join if needed.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Configure executive summary</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-sm font-medium">Delivery channel</span>
            <select
              className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm"
              value={deliveryChannel}
              onChange={(e) => setDeliveryChannel(e.target.value)}
            >
              <option value="email">email</option>
              <option value="slack">slack</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="p3-exec-dest" className="text-sm font-medium">
              Destination
            </label>
            <Input
              id="p3-exec-dest"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="finance-leads@company.com or #executive-risk"
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">Day</span>
            <select
              className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm"
              value={scheduleDay}
              onChange={(e) => setScheduleDay(e.target.value)}
            >
              {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="p3-exec-time" className="text-sm font-medium">
              Time (org TZ)
            </label>
            <Input id="p3-exec-time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} placeholder="09:00" />
          </div>
          <div className="space-y-1">
            <label htmlFor="p3-exec-tz" className="text-sm font-medium">
              Timezone
            </label>
            <Input id="p3-exec-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">Metrics</span>
          <div className="flex flex-wrap gap-2">
            {EXEC_SUMMARY_METRICS.map((m) => (
              <label key={m} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={metrics.includes(m)} onChange={() => toggleMetric(m)} />
                {m.replace(/_/g, " ")}
              </label>
            ))}
          </div>
        </div>
        <Button type="button" disabled={busy || !destination.trim()} onClick={() => void save()}>
          Save preferences
        </Button>
        {msg ? <p className="text-sm text-[var(--text-muted)]">{msg}</p> : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Executive dashboard preview</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Revenue at risk, prevented incidents, approval bottlenecks, and value trends live on the executive surfaces.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link href="/dashboard/executive-risk">Open executive risk</Link>
          </Button>
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link href="/executive">Open executive overview</Link>
          </Button>
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link href="/executive/roi">Open ROI</Link>
          </Button>
        </div>
      </section>
    </Stack>
  );
}
