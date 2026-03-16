"use client";

/**
 * Shared scaffold for integration provider pages.
 * Ensures consistent layout: status card, health card, config section, actions.
 */
type IntegrationConfigScaffoldProps = {
  statusCard: React.ReactNode;
  healthCard?: React.ReactNode;
  configSection: React.ReactNode;
  actionsSection?: React.ReactNode;
  featureToggles?: React.ReactNode;
};

export function IntegrationConfigScaffold({
  statusCard,
  healthCard,
  configSection,
  actionsSection,
  featureToggles,
}: IntegrationConfigScaffoldProps) {
  return (
    <div className="space-y-6">
      {statusCard}
      {healthCard && <div>{healthCard}</div>}
      <div>{configSection}</div>
      {actionsSection && <div>{actionsSection}</div>}
      {featureToggles && <div>{featureToggles}</div>}
    </div>
  );
}
