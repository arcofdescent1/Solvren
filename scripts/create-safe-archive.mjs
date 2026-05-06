/**
 * Cross-platform handoff archive: excludes secrets, build artifacts, and zip bundles.
 * Output: solvren-safe-archive.zip (repo root).
 */
import archiver from "archiver";
import { createWriteStream, existsSync, rmSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";

const OUTPUT = "solvren-safe-archive.zip";
const cwd = process.cwd();

const GLOB_IGNORE = [
  "node_modules/**",
  ".next/**",
  "coverage/**",
  "playwright-report/**",
  "test-results/**",
  "storybook-static/**",
  ".vercel/**",
  "supabase/.temp/**",
  OUTPUT,
  "**/*.zip",
];

function isSecretEnvRelPath(rel) {
  const base = path.basename(rel);
  if (base === ".env.example") return false;
  return base.startsWith(".env");
}

const entries = fg.sync(["**/*"], {
  cwd,
  dot: true,
  onlyFiles: true,
  ignore: GLOB_IGNORE,
});

const files = entries.filter((rel) => !isSecretEnvRelPath(rel));

if (existsSync(OUTPUT)) {
  rmSync(OUTPUT);
}

const outStream = createWriteStream(path.join(cwd, OUTPUT));
const archive = archiver("zip", { zlib: { level: 9 } });

archive.on("warning", (err) => {
  if (err.code !== "ENOENT") throw err;
});

const archiveDone = new Promise((resolve, reject) => {
  outStream.on("close", resolve);
  outStream.on("error", reject);
  archive.on("error", reject);
});

archive.pipe(outStream);

for (const rel of files) {
  const abs = path.join(cwd, rel);
  archive.file(abs, { name: rel.replace(/\\/g, "/") });
}

await archive.finalize();
await archiveDone;

console.log(`Created ${OUTPUT} (${archive.pointer()} bytes, ${files.length} files)`);
