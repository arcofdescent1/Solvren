# Phase 6 workers (A2.3)

Async workers drain `public.processing_jobs` using the **Supabase service role** (`SUPABASE_SERVICE_ROLE_KEY`).

## Run locally

```bash
npm run worker:signal
npm run worker:detector
npm run worker:execution
npm run worker:verification
```

## Production

- Deploy each worker as a separate process or container.
- Scale on **queue depth** / latency (e.g. Cloud Run jobs, K8s HPA on custom metric, or Supabase Edge cron invoking these scripts).
- Enqueue work with `enqueueProcessingJob` (server-side) or direct `insert` via service role.

## Wiring

Replace the no-op handlers in each `*-worker.ts` with calls into:

- Signal path: Phase 3 ingestion (`normalized_signals`, `raw_events`)
- Detector path: detector engine / issue creation
- Execution: playbook & integration action executors
- Verification: issue verification & outcome recording

Migration: `175_phase6_processing_queue.sql`
