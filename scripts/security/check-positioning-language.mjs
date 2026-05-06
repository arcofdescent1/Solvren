#!/usr/bin/env node
/**
 * Phase 5 — Warn on overbroad trust/security claims in scoped surfaces (warning-only).
 * Suppress: // solvren-security-exception: SEC-123 approved phrase in legal context
 */
import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";

const root = process.cwd();
const patterns = [
  "src/app/(marketing)/**/*.{tsx,ts,mdx,md}",
  "src/app/(public)/security/**/*.{tsx,ts,mdx,md}",
  "src/components/marketing/**/*.{tsx,ts,mdx,md}",
  "src/components/security/**/*.{tsx,ts,mdx,md}",
  "docs/**/*.{md,mdx}",
];

const banned = [
  { re: /\b100%\s+of\s+payloads\b/i, code: "SEC-POS-100-PAYLOAD" },
  { re: /\b100%\s+redact/i, code: "SEC-POS-100-REDACT" },
  { re: /\babsolute(?:ly)?\s+secure\b/i, code: "SEC-POS-ABS-SEC" },
  { re: /\bunhackable\b/i, code: "SEC-POS-UNHACK" },
];

function hasSuppression(line, col) {
  return /solvren-security-exception:\s*SEC-\d+/i.test(line) || /solvren-security-exception:\s*SEC-\d+/i.test(col);
}

async function main() {
  const files = await fg(patterns, { cwd: root, dot: false, onlyFiles: true });
  let warnings = 0;
  for (const rel of files) {
    const full = path.join(root, rel);
    let text;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prev = i > 0 ? lines[i - 1] : "";
      if (hasSuppression(line, prev)) continue;
      for (const { re, code } of banned) {
        if (re.test(line)) {
          warnings++;
          console.warn(`[security:positioning] ${code} ${rel}:${i + 1}: ${line.trim()}`);
        }
      }
    }
  }
  if (warnings) {
    console.warn(`[security:positioning] ${warnings} warning(s) — failing the build is not enabled yet.`);
  } else {
    console.log("[security:positioning] OK (no flagged phrases).");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
