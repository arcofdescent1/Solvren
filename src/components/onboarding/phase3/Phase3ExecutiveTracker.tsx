"use client";

import { useEffect } from "react";

/**
 * Records executive surface views for Phase 3 engagement (server audit + sync).
 */
export function Phase3ExecutiveTracker(props: { path: string }) {
  useEffect(() => {
    void fetch("/api/onboarding/phase3/executive-touch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: props.path }),
    }).catch(() => {});
  }, [props.path]);
  return null;
}
