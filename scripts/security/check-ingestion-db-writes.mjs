#!/usr/bin/env node
/**
 * Phase 2 — Typed ingestion write boundary (reviewable, not "grep all .insert").
 *
 * Rules:
 * 1) Only `src/modules/ingestion/ingestion.repository.ts` may chain
 *    `.from('<payload table>').insert(...)` / `.upsert(...)` for payload ingestion tables.
 * 2) Under `src/modules/ingestion/`, only `ingestion.repository.ts` may use `.from(` at all
 *    (adapters must delegate persistence to the repository).
 *
 * Updates/selects on these tables elsewhere are allowed (replay, privacy minimization, reads).
 *
 * Suppress a false positive with:
 *   // solvren-ingestion-boundary-exception: <short reason>
 * on the line immediately before the chained call.
 */
import { readFileSync } from "node:fs";
import fg from "fast-glob";

const INGESTION_ROOT = "src/modules/ingestion";
const CANONICAL_REPO = "src/modules/ingestion/ingestion.repository.ts";

/** Tables whose INSERT/UPSERT must go through ingestion.repository.ts (secure-ingest + privacy). */
const PAYLOAD_INGEST_TABLES = ["raw_events", "integration_inbound_events", "integration_webhook_events"];

const SOURCE_GLOBS = ["src/**/*.ts", "src/**/*.tsx"];
const IGNORE = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/__tests__/**",
  "**/*.stories.tsx",
  "**/vitest.setup.*",
];

function stripTsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function hasBoundaryExceptionNear(content, index) {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const prevLineStart = content.lastIndexOf("\n", lineStart - 2) + 1;
  const prevLine = content.slice(prevLineStart, lineStart - 1).trim();
  return /solvren-ingestion-boundary-exception:/i.test(prevLine);
}

/**
 * Detect `.from('table')` ... `.insert(` / `.upsert(` on the same builder chain.
 * If another `.from(` appears before insert/upsert (new Supabase query), it is not a chained write.
 */
function findChainedWrites(content, table) {
  const violations = [];
  const escaped = table.replace(/\\/g, "\\\\");
  const reFrom = new RegExp(
    `\\.from\\s*\\(\\s*['"\`]${escaped}['"\`]\\s*\\)`,
    "g"
  );
  const WINDOW = 1500;
  let m;
  while ((m = reFrom.exec(content)) !== null) {
    const afterFrom = m.index + m[0].length;
    const slice = content.slice(afterFrom, Math.min(content.length, afterFrom + WINDOW));
    const nextInsert = slice.search(/\.(?:insert|upsert)\s*\(/);
    if (nextInsert === -1) continue;
    const nextFrom = slice.search(/\.from\s*\(/);
    if (nextFrom !== -1 && nextFrom < nextInsert) continue;
    if (!hasBoundaryExceptionNear(content, m.index)) {
      violations.push(m.index);
    }
  }
  return violations;
}

function checkIngestionModuleNoDirectFrom() {
  const files = fg.sync(`${INGESTION_ROOT}/**/*.ts`, {
    ignore: [`${INGESTION_ROOT}/**/*.test.ts`, "**/ingestion.repository.ts"],
  });

  const mentionsSupabaseFrom = /\.from\s*\(\s*[`'"]/;
  let failed = false;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    if (mentionsSupabaseFrom.test(content)) {
      failed = true;
      console.error(`Forbidden direct .from( in ingestion module (use ${CANONICAL_REPO}): ${file}`);
    }
  }
  return failed;
}

function checkRepoWidePayloadWrites() {
  const files = fg.sync(SOURCE_GLOBS, { ignore: IGNORE });
  let failed = false;

  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    if (normalized === CANONICAL_REPO) continue;

    const raw = readFileSync(file, "utf8");
    const content = stripTsComments(raw);

    for (const table of PAYLOAD_INGEST_TABLES) {
      const hits = findChainedWrites(content, table);
      if (hits.length > 0) {
        failed = true;
        console.error(
          `Forbidden payload ingest write: ${file} — .from("${table}").…insert/upsert must live in ${CANONICAL_REPO} (secure-ingest boundary).`
        );
      }
    }
  }
  return failed;
}

const a = checkIngestionModuleNoDirectFrom();
const b = checkRepoWidePayloadWrites();

if (a || b) {
  console.error(
    "\nIngestion writes must go through src/modules/ingestion/ingestion.repository.ts (Phase 2 boundary)."
  );
  process.exit(1);
}

console.log("[security:redaction/ingestion-boundary] OK.");
