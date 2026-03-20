/**
 * Phase 0 — Issues module: application use cases.
 * Wraps or delegates to infrastructure; preserves behavior.
 */

export {
  createIssueFromSource,
  listIssues,
  getIssueDetail,
  appendIssueHistory,
  triageIssue,
  assignIssue,
  startIssueWork,
  resolveIssue,
  dismissIssue,
  reopenIssue,
  addIssueComment,
} from "./issues";

export type { ListIssuesResult, IssueDetailResult } from "./issues";
