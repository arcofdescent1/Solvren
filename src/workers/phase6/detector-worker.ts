/**
 * Phase 6 — detector-worker: consumes `detector` jobs (issue creation / detection runs).
 */
import { drainPhase6Worker } from "./run-phase6-worker";

async function main() {
  await drainPhase6Worker("detector", async (_job) => {
    // Intentionally empty — replace with detector engine invocation.
  });
}

main().catch((e) => {
   
  console.error(e);
  process.exit(1);
});
