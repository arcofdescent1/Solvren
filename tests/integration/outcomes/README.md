# Outcomes integration test pack (follow-on)

Phase 6 ships with unit coverage in `src/lib/outcomes/*.test.ts` and API smoke tests where practical.

This directory is reserved for **database-seeded end-to-end outcomes scenarios** (predict → act → observe → metrics → notifications → reports), to be added as a separate engineering deliverable:

- Predicted risk → corrective action → no incident → `HIGH_CONFIDENCE` story
- Predicted risk → outage signal → `REJECTED` story
- Quarterly metrics recompute → threshold → `notification_outbox` row with dedupe key
- Report worker → storage upload → completion notification

These flows require a running Supabase (or test container) and stable fixtures; they are intentionally not part of the core Phase 6 unit suite.
