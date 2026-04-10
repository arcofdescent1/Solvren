/**
 * Non-blocking footer navigation analytics. Safe to call from click handlers.
 */
export function trackFooterNavigationEvent(eventName: string, payload?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const g = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof g === "function") {
      g("event", eventName, { transport_type: "beacon", ...payload });
    }
  } catch {
    // ignore
  }
}
