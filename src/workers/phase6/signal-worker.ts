/**
 * Phase 6 — signal-worker: consumes `signal_ingestion` jobs.
 * Wire to raw_event → normalized_signals pipeline when ready; v1 is a safe no-op.
 */
import { drainPhase6Worker } from "./run-phase6-worker";

async function main() {
  await drainPhase6Worker("signal_ingestion", async (_job) => {
    // Intentionally empty — replace with ingestion handler.
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
