/**
 * Phase 4 — block customer app routes from importing internal-only UI modules.
 * Suppress: // solvren-security-exception: SEC-123 reason
 */
import { readFileSync } from "node:fs";
import fg from "fast-glob";

const suppression = /\/\/\s*solvren-security-exception:\s*(\S+)(?:\s+.*)?$/;

function lineSuppressed(lines, idx) {
  const line = lines[idx] ?? "";
  if (suppression.test(line.trim())) return true;
  for (let j = idx - 1; j >= 0; j--) {
    const prev = lines[j].trim();
    if (prev === "") continue;
    return suppression.test(prev);
  }
  return false;
}

const forbiddenPatterns = [
  /@\/components\/internal\//,
  /@\/modules\/internal\//,
  /from ["']@\/components\/internal/,
  /from ["']@\/modules\/internal/,
];

const files = fg.sync(["src/app/(app)/**/*.{ts,tsx}", "src/app/api/customer/**/*.{ts,tsx}"], {
  ignore: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**"],
});

let failed = false;

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!forbiddenPatterns.some((re) => re.test(line))) continue;
    if (lineSuppressed(lines, i)) continue;
    if (line.trim().startsWith("//")) continue;
    console.error(`Forbidden internal import in customer surface ${file}:${i + 1}`);
    failed = true;
  }
}

if (failed) {
  console.error("Fix imports or add // solvren-security-exception: SEC-123 reason");
  process.exit(1);
}
