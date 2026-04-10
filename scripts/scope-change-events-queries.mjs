/**
 * Wraps `await <client>.from("change_events").select(...)` with scopeActiveChangeEvents.
 * Only single-line .select(...) (no nested parens in select list). Skips `admin` client.
 *
 * Usage: node scripts/scope-change-events-queries.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const SKIP_PATH_PART = [
  "runDataRetentionSweep",
  "dataLifecycle.ts",
  "/submit/route.ts",
  "scope-change-events-queries.mjs",
  "changeEventScope.ts",
];

const IMPORT = 'import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";\n';

function walkSync(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const name of entries) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walkSync(p, files);
    } else if (/\.(ts|tsx)$/.test(name.name)) files.push(p);
  }
  return files;
}

function transform(content, relPath) {
  if (SKIP_PATH_PART.some((s) => relPath.replace(/\\/g, "/").includes(s))) return content;

  const re =
    /await ([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\.from\("change_events"\)\.select\(([^)]*)\)/g;

  let next = content;
  let changed = false;
  const apply = (full, client, sel) => {
    if (client === "admin") return full;
    if (full.includes("scopeActiveChangeEvents(")) return full;
    changed = true;
    return `await scopeActiveChangeEvents(${client}.from("change_events").select(${sel}))`;
  };

  next = next.replace(re, apply);

  const reMulti =
    /await ([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\s*\n\s*\.from\("change_events"\)\s*\n\s*\.select\(([^)]*)\)/g;
  next = next.replace(reMulti, apply);

  if (changed && !next.includes("@/lib/db/changeEventScope")) {
    const firstImport = next.indexOf("import ");
    if (firstImport === -1) next = IMPORT + next;
    else next = next.slice(0, firstImport) + IMPORT + next.slice(firstImport);
  }

  return next;
}

const roots = ["src/app/api", "src/services", "src/lib", "src/modules", "src/app/(app)"];

let n = 0;
for (const root of roots) {
  for (const abs of walkSync(root)) {
    const rel = abs.replace(/\\/g, "/");
    if (SKIP_PATH_PART.some((s) => rel.includes(s))) continue;
    let s = readFileSync(abs, "utf8");
    if (!s.includes('.from("change_events")')) continue;
    const out = transform(s, rel);
    if (out !== s) {
      writeFileSync(abs, out, "utf8");
      n += 1;
      console.log("updated", rel);
    }
  }
}
console.log("files updated:", n);
