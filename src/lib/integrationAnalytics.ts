/**
 * Integration setup telemetry for onboarding success measurement.
 * Fires custom events that can be captured by PostHog, Segment, etc.
 */
export type IntegrationSetupEvent =
  | "jira_setup_started"
  | "jira_setup_project_selected"
  | "jira_setup_status_mapping_saved"
  | "jira_setup_features_saved"
  | "jira_setup_completed"
  | "jira_setup_connect_clicked"
  | "netsuite_setup_started"
  | "netsuite_setup_credentials_entered"
  | "netsuite_setup_validated"
  | "netsuite_setup_completed"
  | "salesforce_connect_started"
  | "salesforce_connect_success"
  | "salesforce_objects_selected"
  | "salesforce_rules_created"
  | "hubspot_connect_started"
  | "hubspot_connect_success"
  | "hubspot_objects_selected"
  | "hubspot_rules_created";

export function trackIntegrationSetup(
  event: IntegrationSetupEvent,
  payload: Record<string, string | number | boolean | null | undefined> = {}
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("solvren:integration-analytics", {
      detail: { event, payload, ts: Date.now() },
    })
  );

  const w = window as typeof window & { posthog?: { capture: (e: string, p: object) => void }; dataLayer?: unknown[] };
  if (w.posthog?.capture) {
    w.posthog.capture(event, { ...payload, area: "integration_setup" });
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[integration-analytics]", event, payload);
  }
}
