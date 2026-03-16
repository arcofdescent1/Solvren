/**
 * File path detection rules.
 * Simple glob: ** matches any path segments, * matches within segment.
 * pricing-prefix or path-contains-revrec patterns.
 */

import type { FilePathRule } from "./types";

/**
 * Returns true if path matches the glob pattern.
 * - ** matches zero or more path segments
 * - * matches zero or more characters within a segment (no /)
 */
function matchesPattern(path: string, pattern: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  // Normalize pattern: remove leading/trailing slashes
  const normalizedPattern = pattern.replace(/^\/+|\/+$/g, "");

  // Handle simple prefix: foo/** matches path starting with foo/
  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    const prefixSegs = prefix.split("/").filter(Boolean);
    if (prefixSegs.length === 0) return true;
    if (pathSegments.length < prefixSegs.length) return false;
    for (let i = 0; i < prefixSegs.length; i++) {
      if (!segmentMatches(pathSegments[i] ?? "", prefixSegs[i] ?? "")) return false;
    }
    return true;
  }

  // Handle **/foo/** - path must contain segment "foo"
  if (normalizedPattern.startsWith("**/") && normalizedPattern.includes("/**")) {
    const inner = normalizedPattern.slice(3, -3).replace(/\/\*\*\//g, "/");
    const requiredSegs = inner.split("/").filter(Boolean);
    if (requiredSegs.length === 0) return true;
    for (let start = 0; start <= pathSegments.length - requiredSegs.length; start++) {
      let ok = true;
      for (let i = 0; i < requiredSegs.length; i++) {
        if (!segmentMatches(pathSegments[start + i] ?? "", requiredSegs[i] ?? "")) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }

  // Handle **/foo/bar - path must end with foo/bar
  if (normalizedPattern.startsWith("**/")) {
    const suffix = normalizedPattern.slice(3);
    const suffixSegs = suffix.split("/").filter(Boolean);
    if (suffixSegs.length === 0) return true;
    if (pathSegments.length < suffixSegs.length) return false;
    const start = pathSegments.length - suffixSegs.length;
    for (let i = 0; i < suffixSegs.length; i++) {
      if (!segmentMatches(pathSegments[start + i] ?? "", suffixSegs[i] ?? "")) return false;
    }
    return true;
  }

  // No **: exact segment match with * support
  const patternSegs = normalizedPattern.split("/").filter(Boolean);
  if (pathSegments.length !== patternSegs.length) return false;
  for (let i = 0; i < patternSegs.length; i++) {
    if (!segmentMatches(pathSegments[i] ?? "", patternSegs[i] ?? "")) return false;
  }
  return true;
}

function segmentMatches(seg: string, pat: string): boolean {
  if (!pat) return true;
  const regex = new RegExp("^" + pat.replace(/\*/g, "[^/]*") + "$");
  return regex.test(seg);
}

/**
 * Matches a file path against rules. Returns matched rules and the path if matched.
 */
export function matchFilePath(
  path: string,
  rules: FilePathRule[]
): { matched: FilePathRule[]; matchedFiles: string[] } {
  const matchedRules: FilePathRule[] = [];
  const p = path.replace(/\\/g, "/");
  for (const rule of rules) {
    if (matchesPattern(p, rule.pattern)) {
      matchedRules.push(rule);
    }
  }
  return {
    matched: matchedRules,
    matchedFiles: matchedRules.length > 0 ? [path] : [],
  };
}
