export type DocsAnalyticsEvent =
  | "docs_page_view"
  | "docs_search"
  | "docs_search_result_click"
  | "docs_edit_click"
  | "docs_feedback_click"
  | "docs_feedback_helpful"
  | "docs_role_shortcut_click"
  | "docs_screenshot_open";

export function trackDocsEvent(
  event: DocsAnalyticsEvent,
  payload: Record<string, string | number | boolean | null | undefined> = {}
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("solvren:docs-analytics", {
      detail: { event, payload, ts: Date.now() },
    })
  );

  const w = window as typeof window & { dataLayer?: Array<Record<string, unknown>> };
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event, ...payload });
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[docs-analytics]", event, payload);
  }
}
