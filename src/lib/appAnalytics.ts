"use client";

type AppEventPayload = Record<string, unknown>;

type WindowWithAnalytics = Window & {
  posthog?: { capture: (eventName: string, payload?: AppEventPayload) => void };
  analytics?: { track: (eventName: string, payload?: AppEventPayload) => void };
  dataLayer?: unknown[];
};

export function trackAppEvent(eventName: string, payload: AppEventPayload = {}) {
  if (typeof window === "undefined") return;
  const w = window as WindowWithAnalytics;

  if (w.posthog?.capture) {
    w.posthog.capture(eventName, { ...payload, area: "app_shell" });
    return;
  }
  if (w.analytics?.track) {
    w.analytics.track(eventName, { ...payload, area: "app_shell" });
    return;
  }
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event: eventName, ...payload, area: "app_shell" });
    return;
  }
  if (process.env.NODE_ENV !== "production") {
     
    console.debug("[app-analytics]", eventName, payload);
  }
}

