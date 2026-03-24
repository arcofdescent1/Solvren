/**
 * Phase 4 — Security posture summary.
 * Reads evidence files from docs/security to surface last backup validation,
 * last access review, open remediation count, and control health note.
 */
import fs from "fs";
import path from "path";

const DOCS_ROOT = path.join(process.cwd(), "docs", "security");

export type SecurityPostureSummary = {
  lastBackupValidation: string | null;
  lastAccessReview: string | null;
  openRemediationCount: number | undefined;
  controlHealthNote: string | null;
};

function safeReadDir(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function latestFileByPattern(dir: string, pattern: RegExp): { name: string; mtime: Date } | null {
  const files = safeReadDir(dir);
  let latest: { name: string; mtime: Date } | null = null;
  for (const f of files) {
    if (!pattern.test(f)) continue;
    const fp = path.join(dir, f);
    try {
      const stat = fs.statSync(fp);
      if (stat.isFile() && (!latest || stat.mtime > latest.mtime)) {
        latest = { name: f, mtime: stat.mtime };
      }
    } catch {
      /* skip */
    }
  }
  return latest;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse remediation register for Open / In progress count. */
function countOpenRemediation(): number | undefined {
  const fp = path.join(DOCS_ROOT, "security-remediation-register.md");
  try {
    if (!fs.existsSync(fp)) return undefined;
    const content = fs.readFileSync(fp, "utf-8");
    const tableMatch = content.match(/\|\s*ID\s*\|[\s\S]*?---[\s\S]*?([\s\S]*?)(?=\n##|$)/);
    if (!tableMatch) return 0;
    const rows = tableMatch[1].trim().split("\n").filter((r) => r.includes("|") && !/^\|[\s\-:]+\|/.test(r.trim()));
    let open = 0;
    for (const row of rows) {
      const cells = row.split("|").map((c) => c.trim());
      if (cells.length < 8) continue;
      const id = (cells[1] ?? "").trim();
      if (!id || id === "*None*" || id.startsWith("---")) continue;
      const status = (cells[7] ?? "").toLowerCase();
      if (status === "open" || status === "in progress") open++;
    }
    return open;
  } catch {
    return undefined;
  }
}

export function getSecurityPostureSummary(): SecurityPostureSummary {
  const evidenceDir = path.join(DOCS_ROOT, "evidence");

  const backupLatest = latestFileByPattern(path.join(evidenceDir, "backups"), /^\d{4}-\d{2}-backup-validation\.md$/);
  const accessLatest = latestFileByPattern(path.join(evidenceDir, "access-reviews"), /^\d{4}-\d{2}\.md$/);

  return {
    lastBackupValidation: backupLatest
      ? `Last validated ${formatDate(backupLatest.mtime)} (${backupLatest.name})`
      : null,
    lastAccessReview: accessLatest
      ? `Last review ${formatDate(accessLatest.mtime)} (${accessLatest.name})`
      : null,
    openRemediationCount: countOpenRemediation(),
    controlHealthNote: "Update control-health-register.md weekly. See control-operations-calendar.md for cadence.",
  };
}
