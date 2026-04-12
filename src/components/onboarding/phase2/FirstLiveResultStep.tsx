"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { phase2BasePayload } from "./phase2Analytics";

type LiveEvent = {
  type: string;
  title: string;
  description: string;
  createdAt: string;
  ctaUrl: string;
};

export function FirstLiveResultStep(props: {
  orgId: string;
  phase2Status: string | null | undefined;
  currentStepKey: string | null | undefined;
  allComplete: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { orgId, phase2Status, currentStepKey, allComplete, onRefresh } = props;
  const router = useRouter();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef<number | null>(null);
  const seenTracked = useRef(false);
  const completedTracked = useRef(false);

  useEffect(() => {
    if (allComplete) {
      router.replace("/dashboard");
      return;
    }
    if (startedAt.current === null) {
      startedAt.current = Date.now();
    }
    let cancelled = false;
    const iv = setInterval(async () => {
      if (cancelled) return;
      const start = startedAt.current ?? Date.now();
      if (Date.now() - start > 10 * 60 * 1000) {
        setTimedOut(true);
        clearInterval(iv);
        return;
      }
      const res = await fetch("/api/onboarding/phase2/live-result");
      const j = (await res.json()) as { status?: string; event?: LiveEvent | null };
      if (j.status === "READY" && j.event) {
        setEvent(j.event);
        await onRefresh();
        clearInterval(iv);
      }
    }, 10_000);
    void (async () => {
      const res = await fetch("/api/onboarding/phase2/live-result");
      const j = (await res.json()) as { status?: string; event?: LiveEvent | null };
      if (!cancelled && j.status === "READY" && j.event) {
        setEvent(j.event);
        await onRefresh();
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [allComplete, onRefresh, router]);

  useEffect(() => {
    if (!event || seenTracked.current) return;
    seenTracked.current = true;
    trackAppEvent("onboarding_phase2_first_live_result_seen", phase2BasePayload(orgId, phase2Status, currentStepKey));
  }, [event, orgId, phase2Status, currentStepKey]);

  useEffect(() => {
    if (!allComplete || completedTracked.current) return;
    completedTracked.current = true;
    trackAppEvent("onboarding_phase2_completed", phase2BasePayload(orgId, "COMPLETED", currentStepKey));
  }, [allComplete, orgId, currentStepKey]);

  if (allComplete) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm">Activation complete — redirecting…</p>
        </CardBody>
      </Card>
    );
  }

  if (event) {
    return (
      <Card>
        <CardBody>
          <Stack gap={3}>
            <h2 className="text-lg font-semibold">First live result</h2>
            <p className="text-sm font-medium">{event.title}</p>
            <p className="text-sm text-[var(--text-muted)]">{event.description}</p>
            <p className="text-xs text-[var(--text-muted)]">Opens in a new tab so you can return to activation.</p>
            <Button asChild>
              <Link href={event.ctaUrl} target="_blank" rel="noopener noreferrer">
                Open in Solvren
              </Link>
            </Button>
            <Button variant="secondary" type="button" onClick={() => router.push("/dashboard")}>
              Go to dashboard
            </Button>
          </Stack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <Stack gap={3}>
          <h2 className="text-lg font-semibold">Waiting for your first signal</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Solvren is monitoring your connected systems. We poll every 10 seconds for up to 10 minutes for a real issue, approval, workflow run, or
            delivered alert.
          </p>
          {timedOut ? (
            <p className="text-sm text-[var(--text-muted)]">
              Solvren is still monitoring your systems. You can continue to the dashboard and we will notify you as soon as the first event occurs.
            </p>
          ) : null}
          <Button variant="secondary" type="button" onClick={() => router.push("/dashboard")}>
            Continue to dashboard
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}
