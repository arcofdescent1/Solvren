/**
 * Phase 6 — verification-worker: consumes `verification` jobs (post-action verification).
 */
import { drainPhase6Worker } from "./run-phase6-worker";

async function main() {
  await drainPhase6Worker("verification", async (_job) => {
    // Intentionally empty — replace with verification pipeline.
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
