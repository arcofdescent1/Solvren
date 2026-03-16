"use client";

import { useEffect } from "react";

type DocsAnalyticsDetail = {
  event: string;
  payload: Record<string, unknown>;
  ts: number;
};

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
    };
    analytics?: {
      track: (event: string, properties?: Record<string, unknown>) => void;
    };
    gtag?: (...args: unknown[]) => void;
  }
}

export function DocsAnalyticsProvider() {
  useEffect(() => {
    function handler(event: Event) {
      const custom = event as CustomEvent<DocsAnalyticsDetail>;
      const detail = custom.detail;
      if (!detail) return;

      const { event: eventName, payload } = detail;

      if (window.posthog?.capture) {
        window.posthog.capture(eventName, { ...payload, area: "docs" });
      }

      if (window.analytics?.track) {
        window.analytics.track(eventName, { ...payload, area: "docs" });
      }

      if (window.gtag) {
        window.gtag("event", eventName, { ...payload, area: "docs" });
      }

      if (process.env.NODE_ENV === "development") {
        console.debug("[docs-analytics-adapter]", eventName, payload);
      }
    }

    window.addEventListener("solvren:docs-analytics", handler as EventListener);
    return () => {
      window.removeEventListener("solvren:docs-analytics", handler as EventListener);
    };
  }, []);

  return null;
}
