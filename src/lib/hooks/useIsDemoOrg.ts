"use client";

import { useEffect, useState } from "react";

/** Loads `/api/org/is-demo` once for demo Slack simulation + UI hints. */
export function useIsDemoOrg(): { isDemo: boolean | null; loading: boolean } {
  const [isDemo, setIsDemo] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/org/is-demo", { credentials: "include" });
        const j = (await res.json().catch(() => ({}))) as { isDemo?: boolean };
        if (!cancelled) setIsDemo(Boolean(j.isDemo));
      } catch {
        if (!cancelled) setIsDemo(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { isDemo, loading };
}
