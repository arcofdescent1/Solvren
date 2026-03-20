/**
 * Phase 0 — Issues module.
 * Canonical issue lifecycle, listing, and detail.
 */

export * from "./domain";
export * from "./application";
export {
  getNextIssueKey,
  insertIssue,
  selectIssues,
  selectIssueById,
  insertIssueHistory,
  updateIssue,
  insertIssueComment,
} from "./infrastructure";
export type { IssueRow, IssueStatusUpdate } from "./infrastructure";
export * from "./api/schemas";
