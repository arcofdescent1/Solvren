/** Phase 3 — Spreadsheet import guardrails (preview + commit). */
export const SPREADSHEET_MAX_BYTES = 10 * 1024 * 1024;
export const SPREADSHEET_MAX_ROWS = 5000;
export const SPREADSHEET_MAX_COLS = 100;
export const SPREADSHEET_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
/** Rows above this threshold use queued chunk processing after commit. */
export const SPREADSHEET_ASYNC_THRESHOLD = 1000;
export const SPREADSHEET_CHUNK_SIZE = 200;
