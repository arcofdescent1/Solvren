import RetryOutboxButton from "@/components/RetryOutboxButton";
import MarkDeliveredButton from "@/components/MarkDeliveredButton";

export default function DeliveryPanel({
  deliveries,
}: {
  deliveries: Array<{
    id: string;
    channel: string;
    template_key: string;
    status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
    attempt_count: number | null;
    last_error: string | null;
    created_at: string;
    sent_at: string | null;
    delivered_count: number | null;
  }>;
}) {
  const latestByChannel = new Map<string, (typeof deliveries)[number]>();

  for (const d of deliveries) {
    const key = `${d.channel}:${d.template_key}`;
    if (!latestByChannel.has(key)) latestByChannel.set(key, d);
  }

  const rows = Array.from(latestByChannel.values()).slice(0, 10);

  function icon(s: string) {
    if (s === "SENT") return "✅";
    if (s === "FAILED") return "❌";
    if (s === "PROCESSING") return "⏳";
    return "🕒";
  }

  function channelLabel(ch: string) {
    if (ch === "IN_APP") return "In-app";
    if (ch === "SLACK") return "Slack";
    if (ch === "EMAIL") return "Email";
    return ch;
  }

  function deliveredText(d: (typeof deliveries)[number]) {
    if (d.status !== "SENT") return "";
    if (d.channel === "IN_APP") {
      const n = d.delivered_count ?? 0;
      return n > 0 ? `Delivered to ${n}` : "Delivered";
    }
    return "Sent";
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Delivery</h2>
        <div className="text-xs opacity-60">
          Latest per channel + template
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm opacity-70">No notifications queued yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((d) => (
            <div key={d.id} className="border rounded p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">
                  {icon(d.status)} {channelLabel(d.channel)} • {d.template_key}
                </div>
                <div className="text-xs opacity-60">
                  {new Date(d.created_at).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="opacity-80">
                  Status: <span className="font-mono">{d.status}</span>
                  {d.sent_at ? (
                    <>
                      {" • "}
                      Sent:{" "}
                      <span className="font-mono">
                        {new Date(d.sent_at).toLocaleString()}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="text-xs opacity-70">
                  {deliveredText(d)}
                </div>
              </div>

              {d.status !== "SENT" && (d.attempt_count ?? 0) > 0 && (
                <div className="text-xs opacity-70">
                  Attempts: {d.attempt_count}
                </div>
              )}

              {d.last_error && (
                <div className="text-xs border rounded p-2 bg-gray-50">
                  <div className="font-semibold mb-1">Last error</div>
                  <div className="font-mono whitespace-pre-wrap break-words">
                    {d.last_error}
                  </div>
                </div>
              )}

              {(d.status === "FAILED" || d.status === "PENDING") && (
                <div className="flex justify-end gap-2">
                  {d.status === "FAILED" ? (
                    <RetryOutboxButton outboxId={d.id} />
                  ) : null}
                  <MarkDeliveredButton outboxIds={[d.id]} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deliveries.length > rows.length && (
        <div className="text-xs opacity-60">
          Showing latest {rows.length}. (Most recent per channel/template.)
        </div>
      )}
    </div>
  );
}
