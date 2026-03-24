/**
 * Phase 7 — Delegates to `generate-org-purge-inventory.mjs` (Node ESM).
 * Run: npx tsx scripts/generate-org-purge-inventory.ts
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, "generate-org-purge-inventory.mjs");
const r = spawnSync(process.execPath, [script], { stdio: "inherit", cwd: path.join(__dirname, "..") });
process.exit(r.status ?? 1);
