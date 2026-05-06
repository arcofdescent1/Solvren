/**
 * Storage-surface inventory for JSON / webhook / payload columns (not line-by-line triage).
 * Writes security-reports/json-payload-storage-inventory.json (gitignored; CI artifact).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";

const OUT_DIR = "security-reports";
const OUT_FILE = path.join(OUT_DIR, "json-payload-storage-inventory.json");

mkdirSync(OUT_DIR, { recursive: true });

const COLUMN_HINT =
  /(payload|raw_|webhook|dead_letter|headers|request_|response_|error_|result_|inbound|outbound|metadata_json|body_|event_|_events?|integration_.*event)/i;

const files = fg.sync(["supabase/**/*.sql", "src/**/*.{ts,tsx}"], {
  ignore: ["node_modules/**", ".next/**"],
});

/** @type {Map<string, { kind: string, ref: string, evidence: string[] }>} */
const surfaces = new Map();

function addSurface(kind, ref, evidenceLine) {
  const key = `${kind}:${ref}`;
  const cur = surfaces.get(key) ?? { kind, ref, evidence: [] };
  const ev = `${evidenceLine.file}:${evidenceLine.line}`;
  if (!cur.evidence.includes(ev)) cur.evidence.push(ev);
  surfaces.set(key, cur);
}

function routePathFromFile(file) {
  const norm = file.replace(/\\/g, "/");
  const m = norm.match(/src\/app(\/api\/.*?)\/route\.tsx?$/);
  return m ? m[1].replace(/\/\([^)]+\)\//g, "/") : null;
}

for (const file of files) {
  const ext = path.extname(file);
  const content = readFileSync(file, "utf8");

  if (ext === ".sql") {
    const lines = content.split("\n");
    let currentTable = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const create = line.match(
        /^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?)(\w+)\1/i,
      );
      if (create) {
        currentTable = create[2];
        continue;
      }

      const alter = line.match(
        /^\s*alter\s+table\s+(?:only\s+)?(?:public\.)?("?)(\w+)\1/i,
      );
      if (alter) {
        currentTable = alter[2];
        continue;
      }

      const col =
        line.match(/^\s*(\w+)\s+(jsonb|json)\b/i) ||
        line.match(
          /add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+(jsonb|json)\b/i,
        );
      if (col && currentTable) {
        const column = col[1];
        if (COLUMN_HINT.test(column) || COLUMN_HINT.test(currentTable)) {
          addSurface("column", `${currentTable}.${column}`, {
            file,
            line: i + 1,
          });
        }
      }
    }
  }

  if (ext === ".ts" || ext === ".tsx") {
    const route = routePathFromFile(file);
    if (!route) continue;
    if (!/\.(insert|upsert|update)\(/i.test(content)) continue;

    const fromRe = /\.from\(\s*['"]([\w.]+)['"]\s*\)/g;
    let m;
    const tables = new Set();
    while ((m = fromRe.exec(content)) !== null) {
      tables.add(m[1]);
    }

    const writesPayload =
      /payload|raw_|webhook|headers|request_|response_|error_|result_|body|event|metadata/i.test(
        content,
      );
    if (!writesPayload) continue;

    for (const t of tables) {
      addSurface("route_table", `${route} → ${t}`, { file, line: 1 });
    }
  }
}

const storageSurfaces = [...surfaces.values()].sort((a, b) =>
  a.ref.localeCompare(b.ref),
);

writeFileSync(
  OUT_FILE,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      summary: { surfaces: storageSurfaces.length },
      storageSurfaces,
    },
    null,
    2,
  ),
);

console.log(
  `Wrote ${storageSurfaces.length} storage surfaces to ${OUT_FILE}`,
);
