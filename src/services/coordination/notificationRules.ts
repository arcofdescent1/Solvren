export const DOMAIN_NOTIFICATION_CHANNELS: Record<
  string,
  Array<{ channel: "IN_APP" | "EMAIL" | "SLACK"; description: string }>
> = {
  finance: [
    { channel: "IN_APP", description: "Finance stakeholders should receive in-app updates." },
    { channel: "EMAIL", description: "Finance domain routes often require email visibility." },
    { channel: "SLACK", description: "Finance review channels should be informed in Slack." },
  ],
  security: [
    { channel: "IN_APP", description: "Security stakeholders should receive in-app alerts." },
    { channel: "SLACK", description: "Security review channel notifications are recommended." },
  ],
};
