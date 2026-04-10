import { collectAttentionDrivers, type AttentionDriverInput } from "./getPrimaryAttentionDriver";
import { shortInterruptionLine, bulletForDriver } from "./interruptionCopy";

export function getInterruptionReason(args: AttentionDriverInput): string {
  const ranked = collectAttentionDrivers(args);
  const primary = ranked[0]?.code ?? "ROUTINE";
  return shortInterruptionLine(primary);
}

/** Up to 3 lines for executive page — aligned with driver ordering. */
export function getAttentionSummaryLines(args: AttentionDriverInput): string[] {
  const ranked = collectAttentionDrivers(args);
  const lines = ranked.slice(0, 3).map((r) => bulletForDriver(r.code));
  if (lines.length === 0) {
    lines.push(bulletForDriver("ROUTINE"));
  }
  const title = args.view.title?.trim();
  if (title && lines.length < 3) {
    lines.unshift(`“${title.slice(0, 80)}${title.length > 80 ? "…" : ""}” needs a quick executive read.`);
  }
  return lines.slice(0, 3);
}
